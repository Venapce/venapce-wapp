import type { FlowEntryForm, EntryField, EntryFieldKind } from '@/api/types'

/**
 * A flow's entry form, on this side of the wire.
 *
 * A flow designer can declare the input a flow needs (FloMorphic's
 * `preferences.entry`) instead of wiring a node after the start node whose only
 * job was to seed the context. Any launcher can then render that declaration —
 * and venapce is a launcher: the row's "Run flow" dialog used to hand an
 * operator a bare JSON box and expect them to know the shape a flow reads.
 *
 * The declaration is writable in two ways, and this module is where the choice
 * is read:
 *
 *   - **a JSON Schema** → a built form, one typed control per declared
 *     property (see {@link entryFields}). The same controls an operation's
 *     params get, so a flow's form looks like the rest of venapce.
 *   - **a plain JSON object of values** → the easy way in: the document IS what
 *     gets seeded, shown as a flat key/value table.
 *
 * Nothing here validates or seeds: the engine does both (it validates against
 * the flow's own schema and writes the one context path the entry names), and a
 * second implementation of that contract would only drift from it. What this
 * module decides is what the operator sees, and the rules mirror the backend's
 * (models.IsSchemaDocument, inflow.EntryDefaults) so the form and the seed never
 * disagree about which kind of document they are looking at.
 */

/** Where entry values land when the form names no target. */
export const ENTRY_TARGET_DEFAULT = '$._entry'

/**
 * A JSON Schema, or a plain object of values?
 *
 * The test is narrow on purpose — a `$schema` declaration, or a non-empty
 * `properties` object — because the alternative document's keys are a person's
 * own data: reading `{"type": "order"}` as a contract would turn their value
 * into a schema keyword. A schema describing no fields is an empty form, so it
 * reads as plain and shows as the empty table it is.
 */
export function isSchemaDocument(doc: Record<string, unknown> | undefined | null): boolean {
  if (!doc || typeof doc !== 'object') return false
  if ('$schema' in doc) return true
  const props = doc.properties
  return !!props && typeof props === 'object' && !Array.isArray(props) && Object.keys(props as object).length > 0
}

/** Whether this entry is written as a JSON Schema (the false case is plain values). */
export function entryIsSchema(entry: FlowEntryForm | null | undefined): boolean {
  return isSchemaDocument(entry?.form?.schema)
}

/** An entry that actually describes something. An empty document is "no form",
 *  everywhere — not a form with no inputs. */
export function entryHasForm(entry: FlowEntryForm | null | undefined): boolean {
  const schema = entry?.form?.schema
  return !!schema && Object.keys(schema).length > 0
}

/** The entry's write path, defaulted — what the dialog shows as "where this lands". */
export function entryTarget(entry: FlowEntryForm | null | undefined): string {
  const t = entry?.target?.trim()
  return t || ENTRY_TARGET_DEFAULT
}

/**
 * What the fields start at when the resolved view could not be read: for a JSON
 * Schema the defaults it declares, and for a plain-values entry the document
 * itself.
 *
 * The backend resolves this too (GET /api/flows/:id/entry) and its answer is
 * the one to prefer — it is also what an agent over MCP and the designer's own
 * run button get. This is the fallback for the dialog that already holds the
 * flow's preferences and cannot reach that call.
 */
export function entryDefaults(entry: FlowEntryForm | null | undefined): Record<string, unknown> {
  const schema = entry?.form?.schema
  if (!schema || !Object.keys(schema).length) return {}
  if (!isSchemaDocument(schema)) return { ...schema }
  return schemaDefaults(schema)
}

function schemaDefaults(schema: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const props = schema.properties
  if (!props || typeof props !== 'object') return out
  for (const [name, raw] of Object.entries(props as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue
    const prop = raw as Record<string, unknown>
    if ('default' in prop) {
      out[name] = prop.default
      continue
    }
    if (declaresObject(prop)) {
      const nested = schemaDefaults(prop)
      // A property with no defaults of its own contributes nothing, so an
      // absent field stays absent — a flow reads that differently from `{}`.
      if (Object.keys(nested).length) out[name] = nested
    }
  }
  return out
}

function declaresObject(prop: Record<string, unknown>): boolean {
  const t = prop.type
  if (typeof t === 'string') return t === 'object'
  if (Array.isArray(t)) return t.includes('object')
  return 'properties' in prop
}

/**
 * The schema half of the renderer: one declared property becomes one typed
 * control.
 *
 * This is deliberately a subset of JSON Schema — the part that describes a
 * field an operator fills in. Anything it cannot draw honestly (a nested
 * object, a tuple, a oneOf) becomes a JSON cell rather than being dropped or
 * flattened into something it is not, and the whole form has a raw-JSON view
 * behind it for the cases where that is still not enough. The flow's own schema
 * remains the authority: the engine validates the submission against it, so a
 * rule this renderer does not express is enforced at launch, not lost.
 */
export function entryFields(entry: FlowEntryForm | null | undefined): EntryField[] {
  const schema = entry?.form?.schema
  if (!schema || !isSchemaDocument(schema)) return []
  const props = (schema.properties ?? {}) as Record<string, unknown>
  const required = new Set(Array.isArray(schema.required) ? (schema.required as unknown[]).map(String) : [])
  // `order` is not a JSON Schema keyword: the declaration order of
  // `properties` is the one the author wrote, and that is the order to render.
  return Object.entries(props).map(([name, raw]) => {
    const prop = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    return {
      name,
      label: str(prop.title) || name,
      description: str(prop.description) || undefined,
      kind: fieldKind(prop),
      options: Array.isArray(prop.enum) ? (prop.enum as unknown[]) : undefined,
      required: required.has(name),
      default: 'default' in prop ? prop.default : undefined,
      secret: prop.writeOnly === true || str(prop.format) === 'password',
      inputType: inputTypeFor(str(prop.format)),
    }
  })
}

/** Which control one declared property gets. */
function fieldKind(prop: Record<string, unknown>): EntryFieldKind {
  if (Array.isArray(prop.enum)) return 'enum'
  const type = typeOf(prop)
  if (type === 'boolean') return 'boolean'
  if (type === 'number' || type === 'integer') return 'number'
  if (type === 'array') {
    const items = (prop.items && typeof prop.items === 'object' ? prop.items : {}) as Record<string, unknown>
    // A list of plain strings is a tag field; anything else (objects, tuples,
    // a list of lists) is a document, and a document is edited as JSON.
    const itemType = typeOf(items)
    if (!Array.isArray(prop.items) && (itemType === 'string' || itemType === '') && !Array.isArray(items.enum)) return 'string[]'
    return 'json'
  }
  if (type === 'object' || 'properties' in prop) return 'json'
  const format = str(prop.format)
  if (format === 'textarea' || format === 'multiline') return 'text'
  // A long string is a paragraph, not a line — the one place a schema hints at
  // its own control without a keyword for it.
  if (type === 'string' && num(prop.maxLength) > 240) return 'text'
  if (type === 'string' || type === '') return 'string'
  return 'json'
}

/** `type` as one name, tolerating a `["string", "null"]` union (the null is the
 *  schema saying the field may be absent, not a kind of control). */
function typeOf(prop: Record<string, unknown>): string {
  const t = prop.type
  if (typeof t === 'string') return t
  if (Array.isArray(t)) return (t.find((v) => typeof v === 'string' && v !== 'null') as string) ?? ''
  return ''
}

/** The `<input type>` a string format deserves, for the formats a browser
 *  actually helps with. An unknown format is a plain text box — guessing would
 *  only make a field refuse what the flow accepts. */
function inputTypeFor(format: string): string | undefined {
  switch (format) {
    case 'date':
      return 'date'
    case 'date-time':
      return 'datetime-local'
    case 'time':
      return 'time'
    case 'email':
      return 'email'
    case 'uri':
    case 'url':
      return 'url'
    default:
      return undefined
  }
}

/**
 * Coerce what a control produced into the type the field declares, so the
 * engine's validator sees a number where the schema says number rather than the
 * string an `<input>` always hands back.
 *
 * `undefined` means "leave this field out": an empty optional control is an
 * absent field, which a flow reads differently from `""` or `null`.
 */
export function coerceEntryValue(field: EntryField, raw: unknown): unknown {
  switch (field.kind) {
    case 'boolean':
      return raw === true || raw === 'true'
    case 'number': {
      if (raw === '' || raw == null) return undefined
      const n = Number(raw)
      // A non-numeric entry is kept as typed on purpose: it may be a
      // `{{$.path}}` template the engine resolves at run time, exactly as the
      // node forms allow — and if it is simply wrong, the flow's own schema
      // says so in words the operator can act on.
      return Number.isNaN(n) ? raw : n
    }
    case 'string[]':
      if (Array.isArray(raw)) return raw.length ? raw : undefined
      return undefined
    case 'enum':
      return raw === '' || raw == null ? undefined : raw
    case 'json':
      return raw
    default:
      return raw === '' || raw == null ? undefined : String(raw)
  }
}

/**
 * The required fields a submission still leaves empty.
 *
 * The engine is what refuses a bad submission — this only spares the operator a
 * round trip to be told what the form could have said while they were still
 * looking at it. A field with a default is never missing: the engine fills
 * defaults in before it validates, which is what makes a flow's form safe for
 * an unattended launch.
 */
export function missingRequired(fields: EntryField[], values: Record<string, unknown>): string[] {
  return fields
    .filter((f) => {
      if (!f.required || f.default !== undefined) return false
      const v = values[f.name]
      if (v === undefined || v === null || v === '') return true
      return Array.isArray(v) && v.length === 0
    })
    .map((f) => f.label)
}

/**
 * The rows of a plain-values entry: every key the document declares, plus any
 * the current values carry that it does not.
 *
 * The extras matter — a flow whose author has since dropped a key can still be
 * handed one by a saved set of values, and showing it is how the operator
 * learns it is there instead of seeding it blind.
 */
export function entryRows(
  entry: FlowEntryForm | null | undefined,
  values: Record<string, unknown>,
): { key: string; declared: boolean; kind: EntryFieldKind }[] {
  const doc = (entry?.form?.schema ?? {}) as Record<string, unknown>
  const declared = Object.keys(doc)
  const extra = Object.keys(values).filter((k) => !declared.includes(k))
  return [...declared, ...extra].map((key) => ({
    key,
    declared: declared.includes(key),
    // The document is the shape: what the author wrote is what the field
    // should be, with the current value as the fallback for an extra key.
    kind: valueKind(doc[key] !== undefined && doc[key] !== null ? doc[key] : values[key]),
  }))
}

function valueKind(sample: unknown): EntryFieldKind {
  if (typeof sample === 'boolean') return 'boolean'
  if (typeof sample === 'number') return 'number'
  if (sample !== null && typeof sample === 'object') return 'json'
  return 'string'
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function num(v: unknown): number {
  return typeof v === 'number' ? v : 0
}

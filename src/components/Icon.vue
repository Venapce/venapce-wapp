<script setup lang="ts">
import { computed } from 'vue'
import { iconBody } from '@/lib/icons'

// The single way an icon reaches the UI. Geometry comes from lib/icons.ts; this
// component owns the wrapper so every glyph shares one viewBox, one stroke
// weight and one alignment rule — and inherits `currentColor` from the button
// or label around it.
const props = withDefaults(
  defineProps<{
    name: string
    /** Rendered size in px — matches the text it sits beside. */
    size?: number | string
    /** Stroke weight; nudge up for tiny sizes, down for display sizes. */
    width?: number
  }>(),
  { size: 16, width: 1.75 },
)

const body = computed(() => iconBody(props.name))
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="width"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
    class="inline-block shrink-0 align-[-0.125em]"
    v-html="body"
  />
</template>

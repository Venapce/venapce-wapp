<script setup lang="ts">
// The Venapce owl is a flat, single-colour glyph, so the UI needs only one
// asset: its alpha channel drives a CSS mask and `--brand-mark` supplies the
// colour, which flips with the theme like any other token. The favicon can't
// work this way — CSS never reaches the tab strip, so index.html ships a
// per-scheme PNG instead.
// `size` is the glyph's height as any CSS length. Defaulting to `em` locks the
// mark to the type it sits beside: 1.4em is ~1.9x Inter's cap height (0.727em),
// which is the usual weight for an emblem next to a bold wordmark. Pair it with
// `line-height: 1` on that text — Inter's cap band is then centred in the line
// box to within 0.00002em, so plain `align-items: center` is cap-aligned.
withDefaults(defineProps<{ size?: string }>(), { size: '1.4em' })
</script>

<template>
  <span
    class="brand-mark"
    :style="{ '--brand-mark-size': size }"
    role="img"
    aria-label="Venapce"
  />
</template>

<style scoped>
.brand-mark {
  display: block;
  height: var(--brand-mark-size);
  aspect-ratio: 527 / 579;
  background-color: var(--brand-mark);
  -webkit-mask: url('../assets/owl-mark.png') center / contain no-repeat;
  mask: url('../assets/owl-mark.png') center / contain no-repeat;
}
</style>

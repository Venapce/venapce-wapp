<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useUiStore } from '@/stores/ui'

// Instantiate the UI store so the persisted theme is applied on first paint.
useUiStore()
</script>

<template>
  <RouterView />
</template>

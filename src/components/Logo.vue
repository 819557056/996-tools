<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    :class="className"
  >
    <!-- Modern abstract representation of 996/Efficiency -->
    <!-- A clock-like circle but open, implying breaking the cycle -->
    <path d="M12 2v4" />
    <path d="M12 18v4" />
    <path d="M4.93 4.93l2.83 2.83" />
    <path d="M16.24 16.24l2.83 2.83" />
    <path d="M2 12h4" />
    <path d="M18 12h4" />
    <path d="M4.93 19.07l2.83-2.83" />
    <path d="M16.24 7.76l2.83-2.83" />
    <!-- Center lightning bolt for efficiency -->
    <path d="M13 2L9 14h6l-4 8" stroke-width="2.5" class="text-primary" />
  </svg>
</template>

<script setup lang="ts">
defineProps<{
  className?: string
}>()
</script>


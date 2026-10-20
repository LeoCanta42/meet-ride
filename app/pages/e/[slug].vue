<script setup lang="ts">
const route = useRoute()
const slug = route.params.slug as string

// Immediately redirect to /events/[slug] preserving any query params (like ?p=...)
navigateTo({ path: `/events/${slug}`, query: route.query }, { replace: true })
</script>

<template>
  <div class="py-20 text-center">
    <UIcon name="i-lucide-loader-circle" class="h-8 w-8 animate-spin mx-auto text-sky-500 mb-2" />
  </div>
</template>

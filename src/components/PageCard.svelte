<script>
  import { fly, scale } from 'svelte/transition';
  export let index = 0;
  export let hoverIndex = 0;
  export let activeIndex = 0;
  export let position = 0; // -2, -1, 0, 1, 2
  export let zoomOut = false;

  $: isActive = hoverIndex !== null ? hoverIndex === index : activeIndex === index;

</script>

<div class="page-card"
     style="transform: translateY({zoomOut ? (-10+Math.abs(position*3)) : 0}vh) translateX({zoomOut ? (position * 25) : position * 100}vw) scale({zoomOut ? (isActive ? 0.6 : 0.5) : 1}); z-index: {10 - Math.abs(position)}; opacity: { isActive ? 1 : 0.8 }">
  <slot />
</div>

<style>
  .page-card {
    position: absolute;
    top: 0;
    left: 0;
    width: calc(100vw);
    height: calc(100vh - 0px);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    transition: transform 0.22s, z-index 0.1s, opacity 0.2s;
  }
</style>


<script>
  import { toasts } from '$lib/utils/toasts.js';
  import { flip } from 'svelte/animate';
  import { fly, slide } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';

  let hoveredId = null;

  function handleMouseMove(e) {
    const elements = document.querySelectorAll('.toast-card');
    let found = null;

    elements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        found = el.dataset.id;
      }
    });

    hoveredId = found;
  }
</script>

<svelte:window on:mousemove={handleMouseMove} />

<div class="toasts-wrapper">
  {#each $toasts as toast (toast.id)}
    <div
      animate:flip={{ duration: 400, easing: quintOut }}
      out:slide={{ duration: 300 }}
      class="toast-container"
    >
      <div
        in:fly={{ x: 50, duration: 300, easing: quintOut }}
        out:fly={{ x: 50, opacity: 0, duration: 300 }}
        class="toast-card toast-{toast.type}"
        class:is-hovered={hoveredId === String(toast.id)}
        data-id={toast.id}
      >
        <div class="toast-icon-box">
          {#if toast.type === 'error'}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          {:else}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          {/if}
        </div>

        <div class="toast-content">
          {toast.message}
        </div>
      </div>
    </div>
  {/each}
</div>

<style>
  .toasts-wrapper {
    position: fixed;
    bottom: 25px;
    right: 25px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    z-index: 9999;
    align-items: flex-end;
    pointer-events: none;
  }

  .toast-container {
    padding-top: 10px;
    display: flex;
    justify-content: flex-end;
    width: 100%;
  }

  .toast-card {
    pointer-events: none;

    display: flex;
    align-items: stretch;
    background: #1a2a1d;
    border: 1px solid #243a28;
    border-radius: 10px;
    overflow: hidden;
    width: fit-content;
    min-width: 260px;
    max-width: 400px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    flex-shrink: 0;
    transition: opacity 0.2s ease;
  }

  .toast-card.is-hovered {
    opacity: 0.4;
  }

  .toast-icon-box {
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(76, 175, 80, 0.1);
    border-right: 1px solid #243a28;
    padding: 0 14px;
    color: #4caf50;
  }

  .toast-content {
    padding: 14px 18px;
    color: #4caf50;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.4;
  }

  .toast-error { background: #2a1a1a; border: 1px solid #3a2924; }
  .toast-error .toast-content { color: #af4c4c; }
  .toast-error .toast-icon-box { background: rgba(175, 76, 76, 0.1); color: #af4c4c; border-right-color: #3a2924; }
</style>

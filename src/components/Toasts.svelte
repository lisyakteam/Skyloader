<script>
  import { toasts } from '$lib/utils/toasts.js';
  import { fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';
</script>

<div class="toasts-wrapper">
  {#each $toasts as toast (toast.id)}
    <div
      animate:flip={{ duration: 200 }}
      transition:fly={{ x: 30, duration: 300 }}
      class="toast-card"
    >
      <div class="toast-icon-box">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>

      <div class="toast-content">
        {toast.message}
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
    gap: 10px;
    z-index: 9999;
    pointer-events: none;
  }

  .toast-card {
    pointer-events: auto;
    display: flex;
    align-items: stretch;
    background: #1a2a1d;
    border: 1px solid #243a28;
    border-radius: 10px;
    overflow: hidden;
    min-width: 240px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
  }

  .toast-icon-box {
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(76, 175, 80, 0.1);
    border-right: 1px solid #243a28;
    border-radius: 10px;
    padding: 0 14px;
    color: #4caf50;
  }

  .toast-content {
    padding: 12px 16px;
    color: #4caf50;
    font-size: 13px;
    font-weight: 600;
    display: flex;
    align-items: center;
    line-height: 1.4;
  }
</style>

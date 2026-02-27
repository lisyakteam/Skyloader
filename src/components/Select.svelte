<script>
  import { fade } from 'svelte/transition';
  import { spring } from 'svelte/motion';
  import { createEventDispatcher } from 'svelte';

  export let items = [];
  export let value = "";
  export let radius = 100;
  export let scrollSpeed = 20;

  const dispatch = createEventDispatcher();

  let isOpen = false;
  let isSelecting = false;
  let anchorElement;
  let menuPos = { x: 0, y: 0 };

  let rotation = spring(0, { stiffness: 0.08, damping: 0.5 });

  $: isSmall = items.length < 10;
  $: visibleCount = isSmall ? items.length : 10;
  $: step = 360 / visibleCount;

  $: baseIndex = Math.floor($rotation);
  $: visibleSlots = Array.from({ length: visibleCount }, (_, i) => {
    let itemIndex;
    if (isSmall) {
      itemIndex = i;
    } else {
      itemIndex = (baseIndex + i) % items.length;
      if (itemIndex < 0) itemIndex = items.length + itemIndex;
    }

    const currentAngle = isSmall ? (i * step) : (i * step) - ($rotation % 1 * step);

    return {
      id: isSmall ? i : `slot-${baseIndex + i}`,
      label: items[itemIndex],
      angle: currentAngle,
      isCurrent: items[itemIndex] === value
    };
  });

  function updateMenuPos() {
    if (anchorElement) {
      const rect = anchorElement.getBoundingClientRect();
      menuPos = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
    }
  }

  function handleOpen() {
    const idx = items.indexOf(value);
    if (idx !== -1 && !isSmall) {
       rotation.set(idx, { hard: true });
    }

    updateMenuPos();
    isOpen = true;
  }

  function handleWheel(e) {
    if (!isOpen || isSelecting || isSmall) return;
    $rotation += e.deltaY * 0.002 * scrollSpeed;
  }

  function flyFromCenter(node, { duration = 400 }) {
    return {
      duration,
      css: (t) => {
        const u = 1 - t;
        return `
          opacity: ${t};
          transform: translate(calc(var(--x) * ${t}), calc(var(--y) * ${t})) scale(${0.5 + 0.5 * t});
        `;
      }
    };
  }

  function select(itemValue) {
    if (isSelecting) return;
    isSelecting = true;

    value = itemValue;
    dispatch('change', value);
    dispatch('update', value)

    setTimeout(() => {
      isOpen = false;
      isSelecting = false;
    }, 150);
  }

  function portal(node) {
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }

  $: loading = !items?.length
</script>

<svelte:window on:scroll={updateMenuPos} on:resize={updateMenuPos} />

<div class="circular-wrapper">
  <div class="anchor" bind:this={anchorElement}
       on:mouseenter={handleOpen}
       on:click={handleOpen}
       on:wheel|preventDefault={handleWheel}>
    <div class="current-value" class:active={isOpen} class:loading={loading}>
      {#if loading}
        <div class="spinner"></div>
      {:else}
        {value || "Select..."}
      {/if}
    </div>
  </div>

  {#if isOpen}
    <div class="portal-root" use:portal>
      <div class="mouse-leak-detector"
           style:left="{menuPos.x}px"
           style:top="{menuPos.y}px"
           style:width="{radius * 3}px"
           style:height="{radius * 3}px"
           on:mouseleave={() => { if(!isSelecting) isOpen = false }}>

        <div class="orbit"
             on:wheel|preventDefault|stopPropagation={handleWheel}
             transition:fade={{ duration: 100 }}>

          {#each visibleSlots as slot (slot.id)}
            {@const rad = (slot.angle - 230) * (Math.PI / 180)}
            {@const tx = Math.cos(rad) * radius}
            {@const ty = Math.sin(rad) * radius}

            <button
              class="slot-item"
              class:flying={isSelecting && slot.label === value}
              class:fade-out={isSelecting && slot.label !== value}
              style="--x: {tx}px; --y: {ty}px;"
              in:flyFromCenter={{ duration: 300 }}
              on:click|stopPropagation={() => select(slot.label)}
            >
              {slot.label}
            </button>
          {/each}

          {#if !isSmall}
            <div class="scroll-zone"
                 style:transform="translateY({radius * 0.9}px)"
                 on:mousedown={(e) => {
                    const startY = e.clientY;
                    const startRot = $rotation;
                    const onMove = (me) => { $rotation = startRot - (me.clientY - startY) * 0.2; };
                    const onUp = () => { window.removeEventListener('mousemove', onMove); };
                    window.addEventListener('mousemove', onMove);
                    window.addEventListener('mouseup', onUp);
                 }}>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .circular-wrapper {
    display: inline-block;
    position: relative;
    user-select: none;
  }

  .anchor {
    position: relative;
    z-index: 2;
  }

  .current-value {
    height: 30px;
    width: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #111;
    color: #fff;
    border-radius: 30px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    border: 1px solid rgba(255,255,255,0.1);
    box-shadow: 0 4px 10px rgba(0,0,0,0.3);
    text-transform: capitalize;
  }

  .current-value.active {
    background: #333;
  }

  .portal-root {
    position: absolute;
    top: 0; left: 0;
    z-index: 999999;
  }

  .mouse-leak-detector {
    position: fixed;
    transform: translate(-50%, -50%);
    pointer-events: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle, rgba(0,0,0,0.03) 0%, transparent 75%);
  }

  .orbit {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .slot-item {
    position: absolute;
    padding: 6px 14px;
    background: rgba(20, 20, 20, 0.85);
    color: white;
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 20px;
    cursor: pointer;
    white-space: nowrap;
    font-size: 14px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.4);
    transform: translate(var(--x), var(--y));
    text-transform: capitalize;
    transition:
      background 0.2s,
      transform 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28),
      opacity 0.3s;
  }

  .slot-item:not(.flying) {
    animation: jitter 3s infinite ease-in-out;
  }

  .slot-item:hover {
    background: #eee;
    color: #000;
    z-index: 10;
  }

  .slot-item.flying {
    transform: translate(0, 0);
    z-index: 1000;
    background: #fff;
    color: #000;
  }

  .slot-item.fade-out {
    opacity: 0;
    transform: translate(var(--x), var(--y)) scale(0.5);
    pointer-events: none;
  }

  .scroll-zone {
    position: absolute;
    width: 100px;
    height: 35px;
    background: rgba(255,255,255,0.05);
    border: 1px dashed rgba(255,255,255,0.2);
    border-radius: 15px;
    cursor: ns-resize;
    z-index: 1;
    margin-bottom: 100px;
  }
  .scroll-zone:hover {
    background: rgba(255,255,255,0.1);
  }

  @keyframes jitter {
    0%, 100% { transform: translate(var(--x), var(--y)) rotate(0.5deg); }
    50% { transform: translate(var(--x), var(--y)) rotate(-0.5deg); }
  }

  .spinner {
    width: 15px;
    aspect-ratio: 1;
    border-radius: 50%;
    background:
      radial-gradient(farthest-side, #3b5da7 94%, #0000) top/4px 4px no-repeat,
      conic-gradient(#0000 30%, #3b5da7);
    -webkit-mask: radial-gradient(farthest-side, #0000 calc(100% - 4px), #000 0);
    animation: l13 1s infinite linear;
  }

  @keyframes l13{
    100%{transform: rotate(1turn)}
  }
</style>

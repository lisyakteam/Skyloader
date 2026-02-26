<script>
  const sparksCount = 30;
  const sparks = Array.from({ length: sparksCount }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    size: 8 + Math.random() * 4,
    duration: 3 + Math.random() * 4,
    delay: Math.random() * 4,
    xOffset: Math.random() * 15
  }));
</script>

<div class="background-container">
  {#each sparks as spark}
    <div class="spark"
         style="
           left: {spark.left}%;
           width: {spark.size}px;
           height: {spark.size}px;
           animation-duration: {spark.duration}s;
           animation-delay: {spark.delay}s;
           --x-offset: {spark.xOffset}px;
         "></div>
  {/each}

  <div class="bottom-fade"></div>
</div>

<style>
.background-container {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: hidden;
  z-index: -1;
}

/* Теперь вертикальное и горизонтальное смещение в одной анимации */
@keyframes rise-sway {
  0% {
    transform: translateY(0) translateX(0) scale(1);
    opacity: 0;
  }
  10% {
    opacity: 0.2;
  }
  25% {
    transform: translateY(-50px) translateX(calc(var(--x-offset) * 0.5)) scale(0.9);
  }
  50% {
    transform: translateY(-100px) translateX(var(--x-offset)) scale(0.8);
    opacity: 0.7;
  }
  75% {
    transform: translateY(-150px) translateX(calc(var(--x-offset) * 0.5)) scale(0.65);
  }
  100% {
    transform: translateY(-200px) translateX(0) scale(0.5);
    opacity: 0;
  }
}

.spark {
  position: absolute;
  bottom: 0;
  background: #fff;
  border-radius: 10%;
  z-index: -2;
  pointer-events: noen;
  opacity: 0;
  animation: rise-sway linear infinite;
}
  
.bottom-fade {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 200px;
  background: linear-gradient(to top, rgba(0,0,0,0.15), transparent);
  pointer-events: none;
}
</style>


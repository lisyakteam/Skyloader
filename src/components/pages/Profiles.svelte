<script>
  import { modal, accounts, config } from '$lib/stores.js';
  import { fade, scale } from 'svelte/transition';
  import { flip } from 'svelte/animate';

  import PlayerHead from '$components/PlayerHead.svelte';

  let newName = '';

  function addAccount() {
    if (!newName.trim()) return;
    accounts.update(all => [...all, { name: newName.trim(), type: 'offline' }]);
    newName = '';
    modal.set("new-profile")
  }

  function removeAccount(index) {
    accounts.update(all => {
      const filtered = all.filter((_, i) => i !== index);
      if ($config.selectedAccountIndex >= filtered.length) {
        config.update(c => {
          return { ...c, selectedAccountIndex: Math.max(0, filtered.length - 1) };
        });
      }
      return filtered;
    });
  }

  function select(index) {
    config.update(c => {
      return { ...c, selectedAccountIndex: index };
    });
  }
</script>

<div class="profiles-container">
  <header>
    <button class="add-main-btn" on:click={() => $modal = "new-profile"}>
      <span>+</span>НОВЫЙ ПРОФИЛЬ
    </button>
  </header>

  <div class="accounts-grid">
    {#each $accounts as acc, i (acc.name + i)}
      <div
        animate:flip={{duration: 300}}
        class="card"
        class:active={i === $config.selectedAccountIndex}
        on:click={() => select(i)}
      >
        <div class="card-content">
          <PlayerHead username={acc.name}/>
          <div class="info">
            <span class="name">{acc.name}</span>
            <span class="type">{acc.type}</span>
          </div>
        </div>
        {#if $accounts.length > 1}
          <button class="remove-btn" on:click|stopPropagation={() => removeAccount(i)}>×</button>
        {/if}
      </div>
    {/each}
  </div>

  {#if $modal === "new-profile"}
    <div class="modal-overlay" transition:fade={{duration: 200}} on:click|self={() => $modal = null}>
      <div class="modal" transition:scale={{duration: 200, start: 0.95}}>
        <h2>Новый аккаунт</h2>
        <input
          type="text"
          placeholder="Введите никнейм..."
          bind:value={newName}
          on:keydown={e => e.key === 'Enter' && addAccount()}
          autoFocus
        />
        <div class="modal-actions">
          <button class="cancel" on:click={() => $modal = null}>Отмена</button>
          <button class="confirm" on:click={addAccount} disabled={!newName.trim()}>Создать</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .profiles-container {
    color: white;
    font-family: 'Inter', sans-serif;
    background: #181818;
    width: 90%;
    height: 80%;
    border-radius: 20px;
    border: 1px solid #333;
    display: flex;
    flex-direction: column;
    margin-bottom: 30px;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    align-self: flex-end;
    padding: 10px 20px;
    height: 50px;
  }

  h1 { font-weight: 900; font-size: 24px; margin: 0; }

  .add-main-btn {
    background: #4CAF50; border: none; color: white;
    padding: 10px 20px; border-radius: 8px; font-weight: 700;
    cursor: pointer; display: flex; align-items: center; gap: 8px;
    transition: 0.2s;
  }
  .add-main-btn:hover { background: #56be5b; transform: translateY(-2px); }

  .accounts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 15px;
    padding: 10px;
  }

  .card {
    background: #1f1f1f; border: 1px solid #333;
    border-radius: 12px; padding: 15px;
    position: relative; cursor: pointer;
    transition: 0.2s; display: flex; align-items: center;
  }
  .card:hover { border-color: #555; background: #252525; }
  .card.active { border-color: #4CAF50; background: rgba(76, 175, 80, 0.05); }
  .card.active::after {
    content: 'ВЫБРАН'; position: absolute; top: 10px; right: 15px;
    font-size: 8px; font-weight: 900; color: #4CAF50;
  }

  .card-content { display: flex; align-items: center; gap: 15px; }
  .card-content img { width: 48px; height: 48px; border-radius: 8px; background: #111; }

  .info { display: flex; flex-direction: column; }
  .name { font-weight: 700; font-size: 16px; }
  .type { font-size: 11px; color: #666; text-transform: uppercase; }

  .remove-btn {
    position: absolute; bottom: 10px; right: 10px;
    background: none; border: none; color: #444;
    font-size: 18px; cursor: pointer; padding: 5px;
    transition: 0.2s; opacity: 0;
  }
  .card:hover .remove-btn { opacity: 1; }
  .remove-btn:hover { color: #ff5555; }

  .modal-overlay {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.8); backdrop-filter: blur(4px);
    display: flex; justify-content: center; align-items: center; z-index: 1000;
  }

  .modal {
    background: #181818; border: 1px solid #333;
    padding: 30px; border-radius: 16px; width: 340px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.5);
  }
  .modal h2 { margin-top: 0; font-size: 20px; }

  input {
    width: 100%; background: #0f0f0f; border: 1px solid #333;
    padding: 12px; border-radius: 8px; color: white;
    margin: 20px 0; box-sizing: border-box; outline: none;
  }
  input:focus { border-color: #4CAF50; }

  .modal-actions { display: flex; gap: 10px; }
  .modal-actions button {
    flex: 1; padding: 10px; border-radius: 8px; border: none;
    font-weight: 700; cursor: pointer; transition: 0.2s;
  }
  .cancel { background: #2a2a2a; color: #aaa; }
  .confirm { background: #4CAF50; color: white; }
  .confirm:disabled { opacity: 0.3; cursor: not-allowed; }
</style>

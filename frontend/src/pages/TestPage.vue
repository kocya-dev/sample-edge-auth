<script setup lang="ts">
// テスト用ページ
</script>

<template>
  <div class="container">
    <h1>testPage</h1>
    <div class="actions">
      <RouterLink class="back" to="/">戻る</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.container {
  max-width: 600px;
  margin: 50px auto;
  padding: 20px;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  text-align: center;
}

h1 {
  color: #2c3e50;
  margin-bottom: 20px;
}

.actions {
  margin-top: 18px;
}

.back {
  display: inline-block;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid #b0d4f1;
  background-color: #f0f8ff;
  color: #2c3e50;
  text-decoration: none;
}

.back:hover {
  filter: brightness(0.98);
}
</style>

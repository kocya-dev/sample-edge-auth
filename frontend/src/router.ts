import { createRouter, createWebHistory } from "vue-router";

import HomePage from "./pages/HomePage.vue";
import TestPage from "./pages/TestPage.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: HomePage },
    {
      path: "/testPage",
      alias: "/test-page",
      name: "testPage",
      component: TestPage,
      props: (route) => ({
        message: typeof route.query.message === "string" ? route.query.message : "",
      }),
    },
  ],
});

router.beforeEach((to, from) => {
  // SPA 起動直後の初回ナビゲーションでは消費しない（"その後"のページ遷移で渡すため）
  if (from.matched.length === 0) return true;

  let param: string | null = null;
  try {
    param = window.localStorage.getItem("param");
  } catch {
    return true;
  }

  if (!param) return true;

  const currentMessage = to.query.message;
  const hasMessage = (typeof currentMessage === "string" && currentMessage.length > 0) || (Array.isArray(currentMessage) && currentMessage.length > 0);
  if (hasMessage) return true;

  try {
    window.localStorage.removeItem("param");
  } catch {
    // ignore
  }

  return {
    ...to,
    query: {
      ...to.query,
      message: param,
    },
  };
});

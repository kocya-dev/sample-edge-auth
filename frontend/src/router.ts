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

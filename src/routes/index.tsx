import { createFileRoute, redirect } from "@tanstack/react-router";

// "/" redirige directement vers le parcours de montage.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/montage", search: { tab: "editor" } });
  },
});

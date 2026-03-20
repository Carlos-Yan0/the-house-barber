// src/components/layout/PublicLayout.tsx
import { Outlet } from "react-router-dom";
import { Logo } from "@/components/ui/Logo";

export function PublicLayout() {
  return (
    <div className="min-h-dvh bg-dark-500 flex flex-col">
      <Outlet />
    </div>
  );
}

// src/components/ui/Logo.tsx
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  asLink?: boolean;
}

export function Logo({ className, size = "md", asLink = true }: LogoProps) {
  const sizeClasses = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-2xl",
  };

  const content = (
    <span className={cn("logo-text", sizeClasses[size], className)}>
      <span className="text-gold-500">THE HOUSE</span>{" "}
      <span className="text-white">BARBER</span>
    </span>
  );

  if (!asLink) return content;

  return (
    <Link to="/" className="inline-flex items-center hover:opacity-90 transition-opacity">
      {content}
    </Link>
  );
}

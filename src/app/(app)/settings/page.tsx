import { SignOutButton } from "@/components/auth/SignOutButton";

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">Settings</h1>
      <SignOutButton />
    </div>
  );
}

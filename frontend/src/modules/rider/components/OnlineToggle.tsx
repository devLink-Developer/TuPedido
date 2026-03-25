import type { DeliveryAvailability } from "../../../shared/types";

const options: Array<{ value: DeliveryAvailability; label: string }> = [
  { value: "idle", label: "Disponible" },
  { value: "paused", label: "Pausa" },
  { value: "offline", label: "Offline" }
];

export function OnlineToggle({
  value,
  onChange
}: {
  value: DeliveryAvailability;
  onChange: (next: DeliveryAvailability) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            value === option.value ? "bg-ink text-white shadow-float" : "border border-black/10 bg-white text-zinc-700"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

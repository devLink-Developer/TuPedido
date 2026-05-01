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
          className={`kp-category-pill ${value === option.value ? "kp-category-pill-active" : ""}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

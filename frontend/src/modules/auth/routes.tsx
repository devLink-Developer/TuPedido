import { AuthLayout } from "../../app/layouts/AuthLayout";
import { AuthFormCard } from "./components/AuthFormCard";
import { MerchantRegistrationForm } from "./components/MerchantRegistrationForm";
import { RiderRegistrationForm } from "./components/RiderRegistrationForm";

export function LoginRoute() {
  return (
    <AuthLayout>
      <AuthFormCard mode="login" />
    </AuthLayout>
  );
}

export function RegisterRoute() {
  return (
    <AuthLayout>
      <AuthFormCard mode="register" />
    </AuthLayout>
  );
}

export function MerchantRegistrationRoute() {
  return (
    <AuthLayout>
      <MerchantRegistrationForm />
    </AuthLayout>
  );
}

export function RiderRegistrationRoute() {
  return (
    <AuthLayout>
      <RiderRegistrationForm />
    </AuthLayout>
  );
}

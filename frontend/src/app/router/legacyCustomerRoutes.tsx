import { Navigate, useParams } from "react-router-dom";

export function LegacyCustomerOrdersRedirectRoute() {
  return <Navigate to="/c/pedidos" replace />;
}

export function LegacyCustomerOrderRedirectRoute() {
  const { id } = useParams();

  return <Navigate to={id ? `/c/pedido/${id}` : "/c/pedidos"} replace />;
}

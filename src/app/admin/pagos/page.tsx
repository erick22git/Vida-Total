import { redirect } from "next/navigation";
import { PaymentAdmin } from "@/components/admin/payment-admin";
import { requireAdmin } from "@/lib/admin/require-admin";

export default async function AdminPaymentsPage() {
  // El layout de /admin ya exige rol admin; se repite acá porque la página necesita el id del admin para la bitácora.
  const result = await requireAdmin();
  if (!result.ok) redirect("/");
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Pagos y suscripciones</h1>
        <p className="text-sm text-white/45 mt-1">QR de transferencia y comprobantes. La confirmación del pago es manual.</p>
      </div>
      <PaymentAdmin adminId={result.userId} />
    </div>
  );
}

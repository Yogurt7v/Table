import { useAuth } from '@/shared/context/AuthContext';
import { useOrganizationUsers } from '@/shared/hooks/useOrganizationUsers';
import {
  canEditInvoiceField,
  getInvoicePermissions,
  type InvoiceEditableField,
  type OrgRole,
} from '@/features/invoices/invoice-field-access';

export function useInvoicePermissions(orgId: string) {
  const { user } = useAuth();
  const { data: orgUsers } = useOrganizationUsers();

  const assignment = orgUsers?.find(
    (ou) => ou.user_id === user?.id && ou.organization_id === orgId,
  );
  const role: OrgRole = assignment?.role ?? null;

  const permissions = getInvoicePermissions(role);

  return {
    role,
    ...permissions,
    canView: assignment?.can_view_invoices !== false,
    canEditField: (field: InvoiceEditableField) => canEditInvoiceField(role, field),
  };
}

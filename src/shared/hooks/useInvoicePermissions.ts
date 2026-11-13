import { useCurrentOrgUser } from '@/shared/hooks/useCurrentOrgUser';
import {
  canEditInvoiceField,
  getInvoicePermissions,
  type InvoiceEditableField,
  type OrgRole,
} from '@/features/invoices/invoice-field-access';

export function useInvoicePermissions(orgId: string) {
  const assignment = useCurrentOrgUser(orgId);
  const role: OrgRole = assignment?.role ?? null;

  const permissions = getInvoicePermissions(role);

  return {
    role,
    ...permissions,
    canView: assignment?.can_view_invoices !== false,
    canEditField: (field: InvoiceEditableField) => canEditInvoiceField(role, field),
  };
}

import { Select } from '@mantine/core';
import { ROLE_OPTIONS, roleInputStyles } from './InlineRoleCellRoleConstants';

export { ROLE_OPTIONS };

interface InlineRoleCellRoleSelectProps {
  role: Role;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  orgName: string;
}

export function InlineRoleCellRoleSelect({
  role,
  onChange,
  disabled,
  orgName,
}: InlineRoleCellRoleSelectProps) {
  return (
    <Select
      size="xs"
      w={170}
      data={ROLE_OPTIONS}
      value={role}
      onChange={onChange}
      allowDeselect={false}
      aria-label={`Роль: ${orgName}`}
      styles={roleInputStyles(role)}
      disabled={disabled}
    />
  );
}

import { useMantineTheme, Anchor, Breadcrumbs, Button, Menu, Text } from '@mantine/core';
import { useLocation, Link } from 'react-router-dom';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { useMediaQuery } from '@mantine/hooks';

const ROOT_LABEL = 'Счета';

const PAGE_LABELS: Record<string, string> = {
  '/': 'Счета',
  '/mail': 'Почта',
  '/docs': 'Документы',
  '/admin': 'Администрирование',
};

function breadcrumbItems(pathname: string) {
  const label = PAGE_LABELS[pathname];
  if (!label) return null;
  return pathname === '/'
    ? [{ label: ROOT_LABEL, to: '/' }]
    : [{ label: ROOT_LABEL, to: '/' }, { label, to: pathname }];
}

export function BreadcrumbsNav() {
  const { pathname } = useLocation();
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const items = breadcrumbItems(pathname);
  if (!items) return null;

  const currentLabel = items[items.length - 1]?.label;

  if (isMobile) {
    return (
      <Menu width="auto" withinPortal>
        <Menu.Target>
          <Button
            variant="subtle"
            size="xs"
            className="mobile-breadcrumbs-trigger"
            rightSection={<IconChevronDown size={14} />}
          >
            {currentLabel}
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          {items.map((item, idx) => {
            const isCurrent = idx === items.length - 1;

            if (isCurrent) {
              return (
                <Menu.Item
                  key={item.to}
                  fw={700}
                  component="div"          // не интерактивный, не попадает в tab-порядок
                  aria-current="page"
                >
                  {item.label}
                </Menu.Item>
              );
            }

            return (
              <Menu.Item key={item.to} component={Link} to={item.to} c="dimmed">
                {item.label}
              </Menu.Item>
            );
          })}
        </Menu.Dropdown>
      </Menu>
    );
  }

  return (
    <Breadcrumbs
      separator={<IconChevronRight size={14} />}
      separatorMargin="xs"
    >
      {items.map((item, idx) => {
        const isCurrent = idx === items.length - 1;

        if (isCurrent) {
          // текущая страница — «заголовок», не ссылка
          return (
            <Text
              key={item.to}
              size="md"
              fw={700}
              c="var(--mantine-color-text)"
              style={{ lineHeight: 1.2 }}
            >
              {item.label}
            </Text>
          );
        }

        return (
          <Anchor
            key={item.to}
            component={Link}
            to={item.to}
            size="sm"
            c="dimmed"
            underline="hover"
          >
            {item.label}
          </Anchor>
        );
      })}
    </Breadcrumbs>
  );
}

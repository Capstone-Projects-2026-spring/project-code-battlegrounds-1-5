import { notifications } from '@mantine/notifications';
import { Role } from '@prisma/client';

export function showRoleSwapWarning(role: Role) {
  const message = role === Role.CODER
    ? 'Your role will swap in 1 minute. Make sure the tester is ready!' //Coder sees this
    : 'Your role will swap in 1 minute. Make sure the coder is ready!'; //Tester sees this

  notifications.show({
    title: 'Role swap incoming',
    message,
    color: 'yellow',
    autoClose: 7000,
  });
}

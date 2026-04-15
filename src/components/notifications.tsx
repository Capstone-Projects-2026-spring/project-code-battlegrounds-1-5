import { notifications } from '@mantine/notifications';
import { Role } from '@prisma/client';

export function showRoleSwapWarning(role: Role) {

  let swapRole = null;
  if (role === Role.CODER){
    swapRole = Role.TESTER;
  } else if (role === Role.TESTER) {
    swapRole = Role.CODER;
  } else if (role === Role.SPECTATOR) {
    swapRole = 'coder/tester';
  }
  notifications.show({
    title: 'Role swap incoming',
    message: 'Make sure you are ready to swap to ' + swapRole,
    color: 'yellow',
    autoClose: 7000,
  });
}

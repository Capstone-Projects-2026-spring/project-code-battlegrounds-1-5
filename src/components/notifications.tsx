import { notifications } from '@mantine/notifications';
import { Button, Group } from '@mantine/core';
import { Role } from '@prisma/client';
import classes from '../styles/comps/notifications.module.css';

const gradientClassNames = {
  root: classes.gradientRoot,
  title: classes.title,
  description: classes.description,
  closeButton: classes.closeButton,
};

const proClassNames = {
  root: classes.proRoot,
  title: classes.proTitle,
  description: classes.proDescription,
  closeButton: classes.proCloseButton,
};

export function showNotification(title: string, message: string) {
  notifications.show({
    title,
    message,
    autoClose: 5000,
    classNames: proClassNames,
  });
}

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
    classNames: gradientClassNames,
  });
}

export function showErrorNotification(message: string, title: string = 'Error') {
  notifications.show({
    title,
    message,
    color: 'red',
    autoClose: 5000,
    classNames: classes,
  });
}

export function showFriendRequestNotification(
  displayName: string,
  requestId: string,
  onAccept: () => void,
  onDecline: () => void,
) {
  const id = `friend-request-${requestId}`;
  const close = () => notifications.hide(id);

  notifications.show({
    id,
    title: 'Friend Request',
    message: (
      <>
        <span style={{ display: 'block', marginBottom: 8 }}>
          {displayName} wants to be your friend!
        </span>
        <Group gap="xs">
          <Button size="xs" color="green" onClick={() => { onAccept(); close(); }}>
            Accept
          </Button>
          <Button size="xs" color="red" onClick={() => { onDecline(); close(); }}>
            Decline
          </Button>
        </Group>
      </>
    ),
    autoClose: false,
    classNames: gradientClassNames,
  });
}

export function showPartyInviteNotification(
  fromDisplayName: string,
  fromUserId: string,
  onAccept: () => void,
  onDecline: () => void,
) {
  const id = `party-invite-${fromUserId}`;
  const close = () => notifications.hide(id);

  notifications.show({
    id,
    title: 'Party Invite',
    message: (
      <>
        <span style={{ display: 'block', marginBottom: 8 }}>
          {fromDisplayName} invited you to their party!
        </span>
        <Group gap="xs">
          <Button size="xs" color="green" onClick={() => { onAccept(); close(); }}>
            Accept
          </Button>
          <Button size="xs" color="red" onClick={() => { onDecline(); close(); }}>
            Decline
          </Button>
        </Group>
      </>
    ),
    autoClose: false,
    classNames: proClassNames,
  });
}

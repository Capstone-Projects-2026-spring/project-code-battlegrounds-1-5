import { useState } from 'react';
import { Burger, Container, Group, Text, Anchor } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import classes from '../styles/comps/Header.module.css';
import Brand from './Brand';

interface HeaderProps {
  links: string[],
  title: string,
  isSpectator?: boolean
}

export default function HeaderSimple(props: HeaderProps) {
  const [opened, { toggle }] = useDisclosure(false);
  const [active, setActive] = useState(props.links[0]);

  const items = props.links.map((link) => (
    <Anchor
      key={link}
      className={classes.link}
      onClick={(event) => {
        event.preventDefault();
        setActive(link);
      }}
    >
      {link}
    </Anchor>
  ));

  return (
    <header className={classes.header}>
      <Container size="md" className={classes.inner}>

        <Brand blink />
        <Text fw={600} mr="auto">

          {props.isSpectator && (
            <span style={{ marginLeft: 8, color: 'rgb(0, 102, 255)', fontWeight: 500 }}>
              (Spectating)
            </span>
          )}
        </Text>

        <Group gap={6} visibleFrom="xs">
          {items}
        </Group>

        <Burger
          opened={opened}
          onClick={toggle}
          hiddenFrom="xs"
          size="sm"
        />
      </Container>
    </header>
  );
}
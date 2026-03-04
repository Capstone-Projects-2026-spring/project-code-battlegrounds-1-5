import { useState } from 'react';
import { Burger, Container, Group, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
// import { MantineLogo } from '@mantinex/mantine-logo';
import classes from '../styles/comps/Header.module.css';

interface HeaderProps {
  links: string[],
  title: string
}

export default function HeaderSimple(props: HeaderProps) {
  const [opened, { toggle }] = useDisclosure(false);
  // const [active, setActive] = useState(props.links[0].link);
  const [active, setActive] = useState(props.links[0]);


  const items = props.links.map((link) => (
    <a
      key={link}
      // href={link.link}
      className={classes.link}
      // data-active={active === link.link || undefined}
      onClick={(event) => {
        event.preventDefault();
        setActive(link.link);
      }}
    >
      {link}
    </a>
  ));

  return (
    <header className={classes.header}>
      <Container size="md" className={classes.inner}>
        {/* <MantineLogo size={28} /> */}
        
        <Text c="blue.6" fw={600} fz="xl" mr="auto">
          {props.title}
          {/** Optional spectating indicator */}
          {('isSpectator' in props && (props as any).isSpectator) && (
            <span style={{ marginLeft: 8, color: 'rgb(0, 102, 255)', fontWeight: 500 }}>(Spectating)</span>
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
          aria-label="Toggle navigation"
        />
      </Container>
    </header>
  );
}
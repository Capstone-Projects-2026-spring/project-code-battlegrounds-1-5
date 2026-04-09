import { useState } from 'react';
import { Burger, Container, Group, Text, Anchor } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import Link from 'next/link'; // <-- Import Next.js Link
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

  // split the title
  const titleParts = props.title.split('|');
  // get the brand name
  const brandName = titleParts[0]; // "CODE BATTLEGROUNDS "
  // put the remaining info back together.
  const gameInfo = titleParts.slice(1).join('|'); // " GAMEMODE: ... | YOUR ROLE: ..."

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
          {/* mantine anchor tag instead a <a or whatever else we'd use  */}
          {/* <Anchor
            component={Link}
            href="/"
            underline="hover"
            fw={800}
            style={{ letterSpacing: '1px' }}
          >
            {brandName}
          </Anchor> */}

          {/* Remaining status text */}
          {gameInfo && <span style={{ opacity: 0.8, fontWeight: 400 }}> | {gameInfo}</span>}

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
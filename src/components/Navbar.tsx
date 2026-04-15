import { useState } from 'react';
import { Avatar, Burger, Container, Drawer, Group, Text, Anchor } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
// import Link from 'next/link'; // <-- Import Next.js Link
import classes from '../styles/comps/Header.module.css';
import Brand from './Brand';
import SidePanel from './sidebar/SidePanel';

interface HeaderProps {
  title: string | undefined;
  links: string[],
  username: string,
  isSpectator?: boolean
}

export default function HeaderSimple(props: HeaderProps) {
  const [opened, { toggle }] = useDisclosure(false);
  const [active, setActive] = useState(props.links[0]);
  const [openFriend, { toggle: toggleFriend }] = useDisclosure(false);

  // split the title
  const titleParts = props.title?.split('|');
  // const brandName = titleParts[0]; 
  const gameInfo = titleParts?.slice(1).join('|');

  const items = props.links.map((link) => (
    <Anchor
      key={link}
      className={classes.link}
      data-active={active === link || undefined}
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
          {/* mantine anchor tag instead a <a or whatever else we'd use  */}
          {/* <Anchor
            component={Link}
            href="/"
            underline="hover"
            fw={800}
        
        <Text c="blue.6" fw={600} mr="auto">

          <Anchor 
            component={Link} 
            href="/" 
            underline="hover" 
            c="blue.6" 
            fw={800} 
            style={{ letterSpacing: '1px' }}
          >
            {brandName}
          </Anchor> */}

        <Brand blink />
        <Text fw={600} mr="auto">

          {props.isSpectator && (
            <span style={{ marginLeft: 8, color: 'rgb(0, 102, 255)', fontWeight: 500 }}>
              (Spectating)
            </span>
          )}
        </Text>

        {/* <Group gap={6} visibleFrom="xs">
          {items}
        </Group> */}

        <Burger
          opened={opened}
          onClick={toggle}
          hiddenFrom="xs"
          size="sm"
          className={classes.burger}
        />

        <Avatar
          ml="auto"
          name={props.username}
          size="md"
          radius="sm"
          style={{ cursor: 'pointer' }}
          onClick={toggleFriend}
          alt="Profile picture"
        />



        <SidePanel opened={openFriend} onClose={toggleFriend} />
      </Container>
    </header>
  );
}
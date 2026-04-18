import { Drawer } from "@mantine/core";
import PartyBox from "./PartyBox";

interface SidePanelProps {
  opened: boolean
  onClose: () => void
}

export default function SidePanel(props: SidePanelProps) {
  return (
    <Drawer
      opened={props.opened}
      onClose={props.onClose}
      title={"Party"}
      padding="md"
      size="xs"                        // or a fixed value like size="300px"
      withOverlay={false}
      position="right"
    >
      <PartyBox />
    </Drawer>
  );
}
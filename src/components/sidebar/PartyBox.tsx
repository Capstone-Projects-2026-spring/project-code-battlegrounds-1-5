import { Box, Divider, Stack, Tabs } from "@mantine/core";
import { useFriendship } from "@/contexts/FriendshipContext";
import { useParty } from "@/contexts/PartyContext";
import { PartySlots } from "./PartySlots";
import { FriendsTab } from "./FriendsTab";
import { InvitesTab } from "./InvitesTab";

export default function PartyBox() {
  const { incomingRequests } = useFriendship();
  const { pendingInvite } = useParty();

  const inviteCount = incomingRequests.length + (pendingInvite ? 1 : 0);

  return (
    <Stack gap={0}>
      <Box px="md" pb="md">
        <PartySlots />
      </Box>

      <Divider />

      <Tabs defaultValue="friends" styles={{ panel: { padding: "12px 16px 16px" } }}>
        <Tabs.List px="md">
          <Tabs.Tab value="friends" style={{ fontSize: 12 }}>
            Friends
          </Tabs.Tab>
          <Tabs.Tab
            value="invites"
            style={{ fontSize: 12 }}
            rightSection={
              inviteCount > 0 ? (
                <Box
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: "#ef4444",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 500,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 1,
                  }}
                >
                  {inviteCount}
                </Box>
              ) : null
            }
          >
            Invites
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="friends">
          <FriendsTab />
        </Tabs.Panel>
        <Tabs.Panel value="invites">
          <InvitesTab />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
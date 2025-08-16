import styled from "styled-components";

const AdonisHeading = styled.h1`
  font-family: "Adonis", serif;
  font-size: 2rem;
  text-align: center;
  margin-bottom: 1rem;
`;

const BodyText = styled.p`
  font-family: "Georgia Pro", serif;
  font-size: 1.1rem;
  text-align: center;
`;

const Popup = styled.div`
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
  padding: 2rem 1.5rem;
  max-width: 420px;
  margin: 2rem auto;
  z-index: 10;
  position: relative;
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.12);
  z-index: 9;
`;

export function WelcomePopup({
  membership,
  onClose,
}: {
  membership: "none" | "freemium" | "premium" | null;
  onClose: () => void;
}) {
  return (
    <>
      <Overlay onClick={onClose} />
      <Popup>
        {membership === "freemium" && (
          <>
            <AdonisHeading>Welcome</AdonisHeading>
            <BodyText>
              Free members can watch the chat for{" "}
              <b>2 hours per month</b>.
            </BodyText>
          </>
        )}
        {membership === "premium" && (
          <>
            <AdonisHeading>Welcome</AdonisHeading>
            <BodyText>
              Members have <b>unlimited access</b> to
              reading the chat.
              <br />
              <br />
              <b>
                Here's how you can earn a contributor spot:
              </b>
              <ul
                style={{
                  textAlign: "left",
                  fontFamily: "Georgia Pro, serif",
                  margin: "1rem 0 0 1.5rem",
                }}
              >
                <li>
                  Earn 1,000 $TOWNS by receiving likes on
                  your comments during open periods.
                </li>
                <li>
                  Contributors can talk in any chat, DM
                  others, and set an alias/bio (admin
                  approved).
                </li>
                <li>
                  Admins can also assign contributor status
                  manually.
                </li>
              </ul>
            </BodyText>
          </>
        )}
        {membership === "none" && (
          <>
            <AdonisHeading>Access Denied</AdonisHeading>
            <BodyText>
              You do not have a Knead membership NFT.
              <br />
              Please acquire one to access the chat.
            </BodyText>
          </>
        )}
      </Popup>
    </>
  );
}

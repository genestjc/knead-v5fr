import { useState } from "react";

export function ProfileForm({
  initial,
  onSubmit,
}: {
  initial: any;
  onSubmit: (data: any) => void;
}) {
  const [alias, setAlias] = useState(initial?.alias || "");
  const [bio, setBio] = useState(initial?.bio || "");
  const [profilePic, setProfilePic] = useState<File | null>(
    null,
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ alias, bio, profilePic });
      }}
    >
      <label>
        Alias:
        <input
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          required
        />
      </label>
      <label>
        Bio:
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          required
        />
      </label>
      <label>
        Profile Picture:
        <input
          type="file"
          accept="image/*"
          onChange={(e) =>
            setProfilePic(e.target.files?.[0] || null)
          }
        />
      </label>
      <button type="submit">Submit for Approval</button>
    </form>
  );
}

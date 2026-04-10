interface ClubhouseAlert {
  id: number;
  created_at: string;
  message: string;
}

export const fetchLatestClubhouseAlert = async (
  supabaseUrl: string,
  anonKey: string
): Promise<ClubhouseAlert | null> => {
  try {
    const baseUrl = supabaseUrl.replace(/\/$/, "");
    const response = await fetch(
      `${baseUrl}/rest/v1/clubhousealerts?order=created_at.desc&limit=1`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      if (response.status >= 500) {
        console.warn("Failed to fetch clubhouse alerts:", response.status);
      }
      return null;
    }

    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      return data[0];
    }

    return null;
  } catch (err) {
    return null;
  }
};

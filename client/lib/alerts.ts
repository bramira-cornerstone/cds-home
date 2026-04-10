export interface AlertItem {
  id: string;
  title: string;
  body?: string;
  createdAt: number;
  closed?: boolean;
}

export async function fetchAlerts(): Promise<AlertItem[]> {
  return [];
}

export async function fetchAlertsForWallet(): Promise<AlertItem[]> {
  return [];
}

export function generateICS(event: {
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  location?: string;
}) {
  const formatDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Knead Magazine//Events//EN
BEGIN:VEVENT
UID:${Date.now()}@kneadmag.com
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(event.startTime)}
DTEND:${formatDate(event.endTime)}
SUMMARY:${event.title}
DESCRIPTION:${event.description}\\n\\nJoin: https://kneadmag.com/chat
LOCATION:${event.location || 'https://kneadmag.com/chat'}
URL:https://kneadmag.com/chat
END:VEVENT
END:VCALENDAR`;

  return ics;
}

export function downloadICS(
  event: {
    title: string;
    description: string;
    startTime: Date;
    endTime: Date;
    location?: string;
  },
  filename: string
) {
  const icsContent = generateICS(event);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

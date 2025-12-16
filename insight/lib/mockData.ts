export interface Report {
    id: string;
    date: string;
    summary: string;
    ideas: string;
    docUrl: string;
    type: "weekly" | "manual";
}

export const mockReports: Report[] = [
    {
        id: "1",
        date: "Nov 25, 2025",
        summary: "Global: Ceasefire talks in Gaza stall as new aid routes open. Pakistan: Protests erupt in Balochistan over missing persons. Global: UN warns of climate displacement in Sudan.",
        ideas: "1. Reel: '3 Things You Missed in Gaza This Week' \n2. Carousel: 'Why Balochistan is Protesting' \n3. Tweet: 'Climate Justice = Human Rights'",
        docUrl: "#",
        type: "weekly",
    },
    {
        id: "2",
        date: "Nov 18, 2025",
        summary: "Palestine: Al-Aqsa compound restrictions tightened. Pakistan: Smog crisis in Lahore reaches hazardous levels. Global: Rohingya refugees face funding cuts.",
        ideas: "1. Reel: 'Lahore is Choking: What You Can Do' \n2. Story: 'Al-Aqsa Under Siege' \n3. Post: 'Don't Forget the Rohingya'",
        docUrl: "#",
        type: "weekly",
    },
    {
        id: "3",
        date: "Nov 11, 2025",
        summary: "Global: Student protests for Palestine spread to European universities. Pakistan: New digital census results announced. Palestine: Olive harvest season disrupted by settlers.",
        ideas: "1. Video: 'Students Rising Up Worldwide' \n2. Carousel: 'Olive Trees & Resistance' \n3. Poll: 'What news matters most to you?'",
        docUrl: "#",
        type: "weekly",
    },
];

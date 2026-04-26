// services/matchCardGenerator.js - NEW FILE
const sharp = require('sharp');

class MatchCardGenerator {
    async generateCard(matchData) {
        const {
            player1Name,
            player2Name,
            score1,
            score2,
            winner,
            tournamentName,
            date
        } = matchData;

        const isPlayer1Winner = winner === player1Name;
        const isPlayer2Winner = winner === player2Name;

        const svg = `<?xml version="1.0" encoding="UTF-8"?>
        <svg width="500" height="320" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#2563eb" />
                    <stop offset="100%" stop-color="#059669" />
                </linearGradient>
                <linearGradient id="winnerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#f59e0b" />
                    <stop offset="100%" stop-color="#dc2626" />
                </linearGradient>
            </defs>
            
            <rect width="500" height="320" rx="14" fill="#0f172a"/>
            <rect x="2" y="2" width="496" height="316" rx="12" fill="none" stroke="#1e293b" stroke-width="1.5"/>
            
            <rect width="500" height="65" rx="14" fill="url(#headerGrad)"/>
            <rect y="32" width="500" height="33" fill="url(#headerGrad)"/>
            
            <svg x="20" y="18" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                <path d="M4 22h16"/>
                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
            </svg>
            
            <text x="250" y="40" text-anchor="middle" fill="white" font-size="18" font-family="Orbitron, Arial, sans-serif" font-weight="800" letter-spacing="1">eFOOTBALL ARENA</text>
            
            <circle cx="250" cy="155" r="38" fill="#1e293b" stroke="#3b82f6" stroke-width="3"/>
            <text x="250" y="164" text-anchor="middle" fill="#3b82f6" font-size="20" font-family="Orbitron, Arial, sans-serif" font-weight="800">VS</text>
            
            <text x="125" y="105" text-anchor="middle" fill="#e2e8f0" font-size="18" font-family="Inter, Arial, sans-serif" font-weight="700">${this.escapeXml(player1Name)}</text>
            <text x="125" y="195" text-anchor="middle" fill="${isPlayer1Winner ? '#10b981' : '#ef4444'}" font-size="52" font-family="Orbitron, Arial, sans-serif" font-weight="800">${score1}</text>
            
            <text x="375" y="105" text-anchor="middle" fill="#e2e8f0" font-size="18" font-family="Inter, Arial, sans-serif" font-weight="700">${this.escapeXml(player2Name)}</text>
            <text x="375" y="195" text-anchor="middle" fill="${isPlayer2Winner ? '#10b981' : '#ef4444'}" font-size="52" font-family="Orbitron, Arial, sans-serif" font-weight="800">${score2}</text>
            
            <rect x="75" y="235" width="350" height="40" rx="8" fill="url(#winnerGrad)"/>
            
            <svg x="95" y="247" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <polygon points="12 2 15 9 22 9 16 14 19 22 12 17 5 22 8 14 2 9 9 9 12 2"/>
            </svg>
            
            <text x="250" y="260" text-anchor="middle" fill="white" font-size="15" font-family="Inter, Arial, sans-serif" font-weight="700">WINNER: ${this.escapeXml(winner)}</text>
            
            <text x="250" y="295" text-anchor="middle" fill="#64748b" font-size="11" font-family="Inter, Arial, sans-serif" font-weight="500">${this.escapeXml(tournamentName)}</text>
            <text x="250" y="310" text-anchor="middle" fill="#475569" font-size="10" font-family="Inter, Arial, sans-serif" font-weight="400">${date}</text>
        </svg>`;

        const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
        return buffer;
    }

    escapeXml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
}

module.exports = new MatchCardGenerator();
const MISTRAL_BASE = 'https://api.mistral.ai/v1';

const SYSTEM_PROMPT = `Je bent een ervaren NT2-docent en taalanalist gespecialiseerd in Nederlands als Tweede Taal. Je analyseert transcripties van NT2-cursisten.

Je taken:
- Beantwoord de vragen van de docent over de transcriptie nauwkeurig en grondig
- Geef concrete voorbeelden uit de tekst bij je analyse
- Benoem fouten, maar wees constructief en leerzaam
- Gebruik de juiste taalkundige terminologie (fonetisch, morfologisch, syntactisch, etc.) maar leg het ook in begrijpelijke taal uit
- Als er geen specifieke vraag wordt gesteld, geef dan een algemene NT2-analyse: niveau-indicatie (A1-B2), sterke punten, werkpunten, en advies
- Verwijs naar CEFR-niveaus waar relevant
- Houd rekening met de Vlaamse/Nederlandse context van de cursist

Formuleer in het Nederlands. Wees grondig maar niet overdreven lang — de docent wil bruikbare inzichten, geen essay.`;

export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'MISTRAL_API_KEY niet ingesteld' });
  }

  const { transcript, question } = req.body;

  if (!transcript) {
    return res.status(400).json({ error: 'Geen transcript meegegeven' });
  }

  const userMessage = question?.trim()
    ? `Hier is de transcriptie van de cursist:\n\n"""\n${transcript}\n"""\n\nVraag van de docent: ${question}`
    : `Hier is de transcriptie van de cursist:\n\n"""\n${transcript}\n"""\n\nGeef een algemene NT2-analyse: niveau-indicatie (A1-B2), sterke punten, werkpunten, en eventueel advies voor de docent.`;

  try {
    const response = await fetch(`${MISTRAL_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ 
        error: `Analyse mislukt: ${response.status}`, 
        detail: err 
      });
    }

    const data = await response.json();

    if (!data.choices?.[0]?.message?.content) {
      return res.status(500).json({ error: 'Ongeldige LLM respons' });
    }

    return res.status(200).json({
      analysis: data.choices[0].message.content,
      model: data.model || 'mistral-large-latest',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

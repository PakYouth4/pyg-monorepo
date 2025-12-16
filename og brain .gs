/**
 * Weekly Research Agent (Advanced AI Edition)
 *
 * Features:
 * 1. AI-Powered Article Filtering (No more static keywords)
 * 2. Deep YouTube Search (12 Variations + Engagement Ranking)
 * 3. Cross-Verification & Viral Content Strategy
 */

// --- CONFIGURATION ---

const RSS_FEEDS = [
  { name: "Al Jazeera (Gaza)", url: "https://www.aljazeera.com/xml/rss/all.xml" },
  { name: "Dawn News (Pakistan)", url: "https://www.dawn.com/feeds/home/" },
  { name: "Middle East Eye", url: "https://www.middleeasteye.net/rss" },
  { name: "Geo News (Pakistan)", url: "https://www.geo.tv/rss/1/1" }
];

// Gemini Models (Using User's Available Models)
const MODEL_FAST = "gemini-flash-latest"; // For filtering & searching
const MODEL_SMART = "gemini-flash-latest"; // For final report (Flash is good enough and safer for quota)

// --- WEB APP HANDLERS ---

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const topic = data.topic;
    const regions = data.regions; 
    const isPublic = data.isPublic || false; // Default to private

    const result = executeResearch(topic, regions, isPublic);

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      data: result
    })).setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*');

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*');
  }
}

function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// --- MAIN LOGIC ---

function main() {
  Logger.log("Starting Advanced Research Agent...");
  executeResearch(null, null, true); // Weekly runs are public by default
}

function executeResearch(topic, regions, isPublic) {
  Logger.log(`Executing Research. Topic: ${topic || "General Weekly"}`);

  // 1. Fetch ALL News (Raw)
  const rawArticles = fetchAllNews(); 
  Logger.log(`Fetched ${rawArticles.length} raw articles.`);

  // 2. AI Filter: Select only relevant stories
  const relevantArticles = filterArticlesWithAI(rawArticles, topic, regions);
  Logger.log(`AI selected ${relevantArticles.length} relevant articles.`);

  if (relevantArticles.length === 0) {
    return { message: "No relevant articles found." };
  }

  // 3. Generate Search Queries (12 Variations)
  const searchQueries = generateSearchQueries(relevantArticles, topic);
  Logger.log(`Generated ${searchQueries.length} search queries.`);

  // 4. Deep YouTube Search (Ranked by Views)
  const videos = searchYouTubeDeep(searchQueries);
  Logger.log(`Selected Top ${videos.length} Viral Videos.`);

  // 5. Summarize & Verify
  const summaries = generateSummaries(relevantArticles, videos, topic);
  
  // 6. Generate Content Ideas
  const contentIdeas = generateContentIdeas(summaries);

  // 7. Create Google Doc
  const docUrl = createReportDoc(summaries, contentIdeas, topic, searchQueries, videos, relevantArticles);

  // 8. Save to Firebase
  const firestoreResult = saveToFirestore(summaries, contentIdeas, docUrl, topic, isPublic);

  // 9. Send Email
  sendNotificationEmail(docUrl, contentIdeas, topic);

  return {
    docUrl: docUrl,
    summary: summaries,
    ideas: contentIdeas,
    videoCount: videos.length,
    firestore: firestoreResult
  };
}

// --- STEP 1: RSS FETCHING ---

function fetchAllNews() {
  let allArticles = [];
  
  RSS_FEEDS.forEach(feed => {
    try {
      const xml = UrlFetchApp.fetch(feed.url).getContentText();
      const document = XmlService.parse(xml);
      const items = document.getRootElement().getChild("channel").getChildren("item");
      
      // Fetch more items (30) to give AI more choices
      for (let i = 0; i < Math.min(items.length, 30); i++) {
        const item = items[i];
        const title = item.getChildText("title");
        const link = item.getChildText("link");
        const description = item.getChildText("description") || "";
        // Clean HTML tags
        const cleanDesc = description.replace(/<[^>]+>/g, '').substring(0, 200) + "...";
        
        allArticles.push({ source: feed.name, title: title, link: link, snippet: cleanDesc });
      }
    } catch (e) {
      Logger.log(`Error fetching ${feed.name}: ${e.toString()}`);
    }
  });
  
  return allArticles;
}

// --- STEP 2: AI FILTERING ---

function filterArticlesWithAI(articles, userTopic, regions) {
  const apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_KEY_SUMMARY");
  if (!apiKey) throw new Error("GEMINI_KEY_SUMMARY missing");

  // Prepare batch for AI
  // We send titles only to save tokens
  let promptList = articles.map((a, i) => `${i}. ${a.title} (${a.source})`).join("\n");

  let regionKeywords = [];
  if (regions) {
    if (regions.pakistan) regionKeywords.push("Pakistan (Politics, Crisis)");
    if (regions.palestine) regionKeywords.push("Palestine (Gaza, West Bank)");
    if (regions.worldwide) regionKeywords.push("Major Global Muslim Issues (Sudan, Kashmir, etc)");
  }
  
  if (regionKeywords.length === 0) regionKeywords = ["Global News"];

  const criteria = userTopic 
    ? `stories specifically about "${userTopic}"`
    : `stories about ${regionKeywords.join(", ")}`;

  const prompt = `
    I have a list of news headlines.
    Identify which numbers correspond to ${criteria}.
    
    Ignore sports, entertainment, and minor local news.
    Return ONLY a JSON array of the matching index numbers. Example: [0, 5, 12]
    
    Headlines:
    ${promptList}
  `;

  try {
    const responseText = callGemini(prompt, MODEL_FAST, apiKey);
    // Clean response to ensure it's valid JSON
    const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const indices = JSON.parse(jsonStr);
    
    // Map back to article objects
    return indices.map(i => articles[i]).filter(a => a !== undefined);
  } catch (e) {
    Logger.log("AI Filter Error: " + e.toString());
    return articles.slice(0, 5); // Fallback: return top 5
  }
}

// --- STEP 3: QUERY GENERATION ---

function generateSearchQueries(articles, topic) {
  const apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_KEY_SUMMARY");
  
  // Extract top 3 titles
  const topTitles = articles.slice(0, 3).map(a => a.title).join("\n");
  
  const prompt = `
    Based on these news headlines:
    ${topTitles}
    
    Generate 12 distinct YouTube search queries to find viral video footage or analysis.
    Variations:
    - 4 Direct Keywords (e.g. "Gaza School Attack")
    - 4 Emotional/Viral Hooks (e.g. "Palestinians trapped in rubble")
    - 4 News Analysis (e.g. "Al Jazeera Gaza Update")
    
    Return ONLY the queries, one per line.
  `;

  const text = callGemini(prompt, MODEL_FAST, apiKey);
  return text.split("\n").filter(line => line.trim().length > 0).slice(0, 12);
}

// --- STEP 4: DEEP YOUTUBE SEARCH ---

function searchYouTubeDeep(queries) {
  let allVideos = [];
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Search for each query
  queries.forEach(q => {
    try {
      const results = YouTube.Search.list('id,snippet', {
        q: q,
        maxResults: 5, // Get top 5 for this query
        order: 'viewCount', // Optimize for engagement immediately
        type: 'video',
        publishedAfter: oneMonthAgo
      });
      
      if (results.items) {
        results.items.forEach(item => {
          allVideos.push({
            id: item.id.videoId,
            title: item.snippet.title,
            channel: item.snippet.channelTitle,
            publishedAt: item.snippet.publishedAt,
            description: item.snippet.description
          });
        });
      }
    } catch (e) {
      Logger.log(`Search Error for "${q}": ${e.toString()}`);
    }
  });

  // 2. Deduplicate (remove same videos found by different queries)
  const uniqueVideos = [];
  const seenIds = new Set();
  allVideos.forEach(v => {
    if (!seenIds.has(v.id)) {
      seenIds.add(v.id);
      uniqueVideos.push(v);
    }
  });

  // 3. Get Exact Stats (View Counts)
  // YouTube Search API doesn't give view counts, so we need a second call
  // We process in batches of 50 (API limit)
  const finalRanked = [];
  
  for (let i = 0; i < uniqueVideos.length; i += 50) {
    const batch = uniqueVideos.slice(i, i + 50);
    const ids = batch.map(v => v.id).join(',');
    
    try {
      const stats = YouTube.Videos.list('statistics', { id: ids });
      if (stats.items) {
        stats.items.forEach(statItem => {
          const video = batch.find(v => v.id === statItem.id);
          if (video) {
            video.views = parseInt(statItem.statistics.viewCount || "0");
            finalRanked.push(video);
          }
        });
      }
    } catch (e) {
      Logger.log("Stats Error: " + e.toString());
    }
  }

  // 4. Sort by Views (Highest First) & Pick Top 5
  finalRanked.sort((a, b) => b.views - a.views);
  
  return finalRanked.slice(0, 5).map(v => ({
    title: v.title,
    channel: v.channel,
    views: v.views,
    link: `https://www.youtube.com/watch?v=${v.id}`,
    description: v.description
  }));
}

// --- STEP 5: SUMMARIZE & REPORT ---

function generateSummaries(articles, videos, topic) {
  const apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_KEY_SUMMARY");

  let articlesText = articles.map((a, i) => `[Article ${i+1}] ${a.title} - ${a.source}`).join("\n");
  let videosText = videos.map((v, i) => `[Video ${i+1}] ${v.title} (${v.channel}) - ${v.views} views`).join("\n");

  let prompt = `
    You are an Investigative Journalist writing for a Youth Audience.
    Topic: ${topic || "Global Crisis Update"}
    
    DATA SOURCES:
    1. NEWS ARTICLES (The Facts):
    ${articlesText}
    
    2. VIRAL VIDEOS (The On-Ground Reality):
    ${videosText}
    
    TASK: Write a "Weekly Situation Report".
    
    LANGUAGE GUIDELINES:
    - **Intermediate English**: Simple, clear, and powerful. Avoid complex academic words.
    - **Tone**: Serious but accessible. Like a top-tier YouTuber explaining a complex issue.
    - **No Fluff**: Get straight to the point.
    
    REQUIRED STRUCTURE:
    # [CATCHY MAIN HEADLINE SUMMARIZING THE WEEK]
    
    ## 1. THE BIG PICTURE
    (One paragraph explaining the most important thing happening right now. Why does it matter?)
    
    ## 2. KEY DEVELOPMENTS (Categorized)
    ### [Topic A: e.g., Gaza Crisis]
    *   **What Happened**: Simple explanation of the event.
    *   **The Hidden Detail**: What are the news articles missing but the videos showing?
    
    ### [Topic B: e.g., Pakistan Politics]
    *   **The Update**: What is the latest move?
    *   **Why it Matters**: How does this affect the common person?
    
    ## 3. VIRAL PULSE
    (Analyze the videos. What is the "Street Narrative"? Are people angry, hopeful, or distracted?)
    
    ## 4. PREDICTION
    (What is likely to happen next week? Keep it grounded.)
  `;

  return callGemini(prompt, MODEL_SMART, apiKey);
}

function generateContentIdeas(summaryText) {
  const apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_KEY_IDEAS");
  const prompt = `Based on this intelligence briefing:\n${summaryText}\nGenerate 3 viral Instagram Reel ideas that focus on the "Hidden Truths" or "Predictions". Hook the audience immediately.`;
  return callGemini(prompt, MODEL_SMART, apiKey);
}

function createReportDoc(summary, ideas, topic, searchQueries, videos, articles) {
  const folderId = PropertiesService.getScriptProperties().getProperty("TARGET_FOLDER_ID");
  const cleanId = folderId ? folderId.split('?')[0].trim() : null;
  if (!cleanId) throw new Error("TARGET_FOLDER_ID missing or invalid");
  
  const dateStr = new Date().toLocaleDateString();
  const doc = DocumentApp.create(`Intel Report: ${topic || "Weekly"} (${dateStr})`);
  const body = doc.getBody();
  
  // --- STYLES ---
  const titleStyle = {};
  titleStyle[DocumentApp.Attribute.FONT_SIZE] = 24;
  titleStyle[DocumentApp.Attribute.BOLD] = true;
  titleStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = "#8B0000"; // Dark Red

  const headerStyle = {};
  headerStyle[DocumentApp.Attribute.FONT_SIZE] = 16;
  headerStyle[DocumentApp.Attribute.BOLD] = true;
  headerStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = "#333333";
  
  const normalStyle = {};
  normalStyle[DocumentApp.Attribute.FONT_SIZE] = 11;
  normalStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = "#000000";

  // --- CONTENT ---
  
  // Title
  const titlePara = body.appendParagraph(`Strategic Intelligence Report`);
  titlePara.setAttributes(titleStyle);
  titlePara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  
  body.appendParagraph(`Topic: ${topic || "General Weekly Scan"} | Date: ${dateStr}`).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendHorizontalRule();
  
  // Summary Section (We assume Gemini gives us Markdown-ish text, we'll just paste it for now but clean it up slightly)
  // Ideally, we would parse markdown, but for now let's just make it readable.
  body.appendParagraph("1. INTELLIGENCE BRIEFING").setAttributes(headerStyle);
  body.appendParagraph(summary).setAttributes(normalStyle);
  
  body.appendPageBreak();
  
  // Ideas Section
  body.appendParagraph("2. CONTENT STRATEGY").setAttributes(headerStyle);
  body.appendParagraph(ideas).setAttributes(normalStyle);
  
  body.appendPageBreak();

  // --- AUDIT LOG SECTION ---
  body.appendParagraph("APPENDIX: RESEARCH AUDIT LOG").setAttributes(headerStyle);
  body.appendParagraph("Transparency Report: How this intel was gathered.").setAttributes({[DocumentApp.Attribute.ITALIC]: true});
  
  // 1. Search Queries Used
  body.appendParagraph("\nGenerated YouTube Search Queries:").setBold(true);
  searchQueries.forEach(q => {
    body.appendListItem(q).setGlyphType(DocumentApp.GlyphType.BULLET);
  });
  
  // 2. Videos Found
  body.appendParagraph("\nTop Viral Videos Found:").setBold(true);
  videos.forEach(v => {
    body.appendListItem(`${v.title} (${v.channel}) - [${v.views.toLocaleString()} views]`).setGlyphType(DocumentApp.GlyphType.BULLET);
  });
  
  // 3. Articles Used
  body.appendParagraph("\nRelevant Articles Analyzed:").setBold(true);
  articles.forEach(a => {
    body.appendListItem(`${a.title} (${a.source})`).setGlyphType(DocumentApp.GlyphType.BULLET);
  });
  
  const file = DriveApp.getFileById(doc.getId());
  DriveApp.getFolderById(cleanId).addFile(file);
  DriveApp.getRootFolder().removeFile(file);
  
  return doc.getUrl();
}

function saveToFirestore(summary, ideas, docUrl, topic, isPublic) {
  const projectId = PropertiesService.getScriptProperties().getProperty("FIREBASE_PROJECT_ID");
  const clientEmail = PropertiesService.getScriptProperties().getProperty("FIREBASE_CLIENT_EMAIL");
  const privateKey = PropertiesService.getScriptProperties().getProperty("FIREBASE_PRIVATE_KEY");
  
  if (!projectId || !clientEmail || !privateKey) {
    Logger.log("Skipping Firebase: Credentials missing.");
    return { success: false, log: "Skipping Firebase: Credentials missing in Script Properties." };
  }
  
  // --- KEY CLEANING & DEBUGGING ---
  let cleanKey = privateKey;
  
  // 1. Remove surrounding quotes if user pasted them (common mistake)
  if (cleanKey.startsWith('"') && cleanKey.endsWith('"')) {
    cleanKey = cleanKey.substring(1, cleanKey.length - 1);
  }
  
  // 2. Replace literal \n with actual newlines
  cleanKey = cleanKey.replace(/\\n/g, '\n');
  
  // 3. Fix missing headers (Common copy-paste error)
  if (!cleanKey.includes("-----BEGIN PRIVATE KEY-----")) {
    Logger.log("DEBUG: Adding missing PEM headers to key.");
    cleanKey = "-----BEGIN PRIVATE KEY-----\n" + cleanKey;
  }
  if (!cleanKey.includes("-----END PRIVATE KEY-----")) {
    cleanKey = cleanKey + "\n-----END PRIVATE KEY-----";
  }
  
  Logger.log("DEBUG: Key Start: " + cleanKey.substring(0, 30) + "...");
  // --------------------------------

  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/reports`;
  const payload = {
    fields: {
      date: { timestampValue: new Date().toISOString() },
      summary: { stringValue: summary },
      ideas: { stringValue: ideas },
      docUrl: { stringValue: docUrl },
      type: { stringValue: topic ? "manual" : "weekly" },
      topic: { stringValue: topic || "General" },
      isPublic: { booleanValue: isPublic !== undefined ? isPublic : true }
    }
  };

  const token = getOAuthToken(clientEmail, cleanKey);
  const response = UrlFetchApp.fetch(firestoreUrl, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + token },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();
  Logger.log("Firestore Response: " + responseBody);

  if (responseCode >= 200 && responseCode < 300) {
    return { success: true, log: "Saved to Firestore" };
  } else {
    return { success: false, log: "Firestore Error: " + responseBody };
  }
}

function sendNotificationEmail(docUrl, ideas, topic) {
  const recipients = PropertiesService.getScriptProperties().getProperty("EMAIL_RECIPIENTS");
  if (recipients) {
    MailApp.sendEmail({
      to: recipients,
      subject: `[Agent] New Report: ${topic || "Weekly"}`,
      body: `Report Ready: ${docUrl}\n\nIdeas:\n${ideas}`
    });
  }
}

// --- HELPERS ---

function callGemini(prompt, model, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    muteHttpExceptions: true
  });
  
  const json = JSON.parse(response.getContentText());
  if (json.error) throw new Error(json.error.message);
  return json.candidates[0].content.parts[0].text;
}

function getOAuthToken(clientEmail, privateKey) {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };

  const toSign = Utilities.base64EncodeWebSafe(JSON.stringify(header)) + "." + Utilities.base64EncodeWebSafe(JSON.stringify(claim));
  const signatureBytes = Utilities.computeRsaSha256Signature(toSign, privateKey);
  const signature = Utilities.base64EncodeWebSafe(signatureBytes);
  const jwt = toSign + "." + signature;

  const params = {
    method: "post",
    payload: {
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    }
  };
  
  const tokenResp = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", params);
  return JSON.parse(tokenResp.getContentText()).access_token;
}

function debugListModels() {
  // Keep debug function for future use
  const apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_KEY_SUMMARY");
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  Logger.log(UrlFetchApp.fetch(url).getContentText());
}

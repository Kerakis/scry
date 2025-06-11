import fs from 'fs/promises';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const FORMATS = [
  'Standard',
  'Pauper',
  'Pioneer',
  'Modern',
  'Legacy',
  'Vintage',
];

// Get the directory name for ES modules (fixed for Windows)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../public/data');
const CACHE_DIR = path.join(__dirname, '../.cache');

// Map format names to their legality keys in the Scryfall data
const FORMAT_MAPPING = {
  Standard: 'standard',
  Pauper: 'pauper',
  Pioneer: 'pioneer',
  Modern: 'modern',
  Legacy: 'legacy',
  Vintage: 'vintage',
};

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      console.log(`Attempt ${i + 1} failed for ${url}:`, error.message);
      if (i === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

async function getBulkDataInfo() {
  console.log('🔍 Fetching bulk data information...');
  const response = await fetchWithRetry('https://api.scryfall.com/bulk-data');
  const data = await response.json();

  const oracleCards = data.data.find((item) => item.type === 'oracle_cards');
  if (!oracleCards) {
    throw new Error('Oracle cards bulk data not found');
  }

  console.log(`📋 Found Oracle Cards: ${oracleCards.name}`);
  console.log(`📅 Updated: ${oracleCards.updated_at}`);
  console.log(`📦 Size: ${(oracleCards.size / 1024 / 1024).toFixed(2)} MB`);

  return oracleCards;
}

async function getCachedBulkData(bulkInfo) {
  // Create cache directory if it doesn't exist
  await fs.mkdir(CACHE_DIR, { recursive: true });

  const cacheFileName = `oracle-cards-${bulkInfo.updated_at.replace(
    /[:.]/g,
    '-'
  )}.json`;
  const cacheFilePath = path.join(CACHE_DIR, cacheFileName);

  try {
    console.log('🔍 Checking for cached data...');
    const cachedData = await fs.readFile(cacheFilePath, 'utf8');
    const jsonData = JSON.parse(cachedData);
    console.log(`✅ Using cached data with ${jsonData.length} cards`);
    return jsonData;
  } catch (error) {
    console.log('📭 No cached data found, will download fresh data');
    return null;
  }
}

async function downloadBulkData(bulkInfo) {
  // Check for cached data first
  const cachedData = await getCachedBulkData(bulkInfo);
  if (cachedData) {
    return cachedData;
  }

  console.log('⬇️ Downloading bulk data...');
  const response = await fetchWithRetry(bulkInfo.download_uri);

  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status}`);
  }

  // Get the raw buffer
  const buffer = Buffer.from(await response.arrayBuffer());
  console.log(`📦 Downloaded ${buffer.length} bytes`);

  let jsonData;

  try {
    // First, try to decompress as gzip
    console.log('🔓 Attempting gzip decompression...');
    const decompressed = zlib.gunzipSync(buffer);
    jsonData = JSON.parse(decompressed.toString());
    console.log('✅ Successfully decompressed gzipped data');
  } catch (gzipError) {
    console.log('⚠️ Gzip decompression failed, trying as plain JSON...');
    try {
      // If gzip fails, try parsing as plain JSON
      jsonData = JSON.parse(buffer.toString());
      console.log('✅ Successfully parsed as plain JSON');
    } catch (jsonError) {
      console.error('❌ Failed to parse as both gzip and plain JSON');
      console.error('Gzip error:', gzipError.message);
      console.error('JSON error:', jsonError.message);
      throw new Error('Unable to parse downloaded data');
    }
  }

  console.log(`✅ Processed ${jsonData.length} cards`);

  // Cache the data for future use
  const cacheFileName = `oracle-cards-${bulkInfo.updated_at.replace(
    /[:.]/g,
    '-'
  )}.json`;
  const cacheFilePath = path.join(CACHE_DIR, cacheFileName);

  try {
    await fs.writeFile(cacheFilePath, JSON.stringify(jsonData));
    console.log(`💾 Cached data saved to ${cacheFileName}`);
  } catch (cacheError) {
    console.warn('⚠️ Failed to cache data:', cacheError.message);
  }

  return jsonData;
}

function processCard(card) {
  // Extract only the data we need for the game
  const processedCard = {
    id: card.id,
    name: card.name,
    scryfall_uri: card.scryfall_uri,
    layout: card.layout,
    // Remove legalities - we'll store specific legal formats instead
  };

  // Handle different image layouts
  if (card.image_uris) {
    // Single-faced card
    processedCard.image_uris = {
      art_crop: card.image_uris.art_crop,
      border_crop: card.image_uris.border_crop,
    };
  }

  // Handle double-faced cards and other special layouts
  if (card.card_faces && card.card_faces.length > 0) {
    processedCard.card_faces = card.card_faces.map((face) => ({
      name: face.name,
      image_uris: face.image_uris
        ? {
            art_crop: face.image_uris.art_crop,
            border_crop: face.image_uris.border_crop,
          }
        : null,
    }));
  }

  return processedCard;
}

function isCardLegalInFormat(card, format) {
  const legalityKey = FORMAT_MAPPING[format];
  if (!legalityKey || !card.legalities) {
    return false;
  }

  const legality = card.legalities[legalityKey];
  return legality === 'legal';
}

function hasUsableArt(card) {
  // Check if card has art we can use for the game
  if (card.image_uris && card.image_uris.art_crop) {
    return true;
  }

  if (card.card_faces && card.card_faces.length > 0) {
    return (
      card.card_faces[0].image_uris && card.card_faces[0].image_uris.art_crop
    );
  }

  return false;
}

function logUnusableArtCards(allCards) {
  console.log('\n🔍 Analyzing cards with unusable art...');

  const unusableArtCards = [];
  const unusableByFormat = {};

  // Initialize format counters
  for (const format of FORMATS) {
    unusableByFormat[format] = [];
  }

  for (const card of allCards) {
    // Check if card has unusable art but is legal in formats
    if (!hasUsableArt(card)) {
      const legalFormats = [];
      for (const format of FORMATS) {
        if (isCardLegalInFormat(card, format)) {
          legalFormats.push(format);
          unusableByFormat[format].push({
            name: card.name,
            id: card.id,
            layout: card.layout,
            has_image_uris: !!card.image_uris,
            has_card_faces: !!(card.card_faces && card.card_faces.length > 0),
            card_faces_with_images: card.card_faces
              ? card.card_faces.filter(
                  (face) => face.image_uris && face.image_uris.art_crop
                ).length
              : 0,
            scryfall_uri: card.scryfall_uri,
          });
        }
      }

      if (legalFormats.length > 0) {
        unusableArtCards.push({
          name: card.name,
          id: card.id,
          layout: card.layout,
          formats: legalFormats,
          has_image_uris: !!card.image_uris,
          has_card_faces: !!(card.card_faces && card.card_faces.length > 0),
          scryfall_uri: card.scryfall_uri,
        });
      }
    }
  }

  // Log summary to console
  console.log(
    `📊 Found ${unusableArtCards.length} cards with unusable art that are legal in formats`
  );
  for (const format of FORMATS) {
    if (unusableByFormat[format].length > 0) {
      console.log(
        `📈 ${format}: ${unusableByFormat[format].length} unusable cards`
      );
    }
  }

  return { unusableArtCards, unusableByFormat };
}

async function saveUnusableArtReport(unusableArtCards, unusableByFormat) {
  console.log('\n📝 Saving unusable art report...');

  // Create report directory
  const REPORT_DIR = path.join(__dirname, '../reports');
  await fs.mkdir(REPORT_DIR, { recursive: true });

  // Generate detailed report
  let report = `# Unusable Art Cards Report\n`;
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += `## Summary\n`;
  report += `Total cards with unusable art that are legal in formats: ${unusableArtCards.length}\n\n`;

  // Format breakdown
  report += `## Cards by Format\n\n`;
  for (const format of FORMATS) {
    if (unusableByFormat[format].length > 0) {
      report += `### ${format} (${unusableByFormat[format].length} cards)\n\n`;
      unusableByFormat[format].forEach((card) => {
        report += `- **${card.name}** (${card.layout})\n`;
        report += `  - ID: ${card.id}\n`;
        report += `  - Has main image_uris: ${card.has_image_uris}\n`;
        report += `  - Has card_faces: ${card.has_card_faces}\n`;
        report += `  - Card faces with images: ${card.card_faces_with_images}\n`;
        report += `  - [View on Scryfall](${card.scryfall_uri})\n\n`;
      });
    }
  }

  // Layout analysis
  const layoutCounts = {};
  unusableArtCards.forEach((card) => {
    layoutCounts[card.layout] = (layoutCounts[card.layout] || 0) + 1;
  });

  report += `## Layout Analysis\n\n`;
  Object.entries(layoutCounts)
    .sort(([, a], [, b]) => b - a)
    .forEach(([layout, count]) => {
      report += `- **${layout}**: ${count} cards\n`;
    });

  // All unusable cards list
  report += `\n## Complete List\n\n`;
  unusableArtCards.forEach((card) => {
    report += `- **${card.name}** (${
      card.layout
    }) - Legal in: ${card.formats.join(', ')}\n`;
    report += `  - [View on Scryfall](${card.scryfall_uri})\n`;
  });

  // Save report
  const reportPath = path.join(REPORT_DIR, 'unusable-art-cards.md');
  await fs.writeFile(reportPath, report);

  // Also save as JSON for programmatic use
  const jsonData = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalCards: unusableArtCards.length,
      formatBreakdown: Object.fromEntries(
        FORMATS.map((format) => [format, unusableByFormat[format].length])
      ),
      layoutBreakdown: layoutCounts,
    },
    cardsByFormat: unusableByFormat,
    allCards: unusableArtCards,
  };

  const jsonPath = path.join(REPORT_DIR, 'unusable-art-cards.json');
  await fs.writeFile(jsonPath, JSON.stringify(jsonData, null, 2));

  console.log(`✅ Unusable art report saved:`);
  console.log(`   📄 Markdown: ${reportPath}`);
  console.log(`   📊 JSON: ${jsonPath}`);
}

// Update the processFormatData function:
async function processFormatData(allCards) {
  console.log('\n🔄 Processing format data...');

  // Analyze unusable art cards
  const { unusableArtCards, unusableByFormat } = logUnusableArtCards(allCards);

  // Save the report to files
  await saveUnusableArtReport(unusableArtCards, unusableByFormat);

  const allFormatCards = [];
  const formatCounts = {};

  // Initialize format counters
  for (const format of FORMATS) {
    formatCounts[format] = 0;
  }

  let processedCount = 0;

  for (const card of allCards) {
    processedCount++;

    if (processedCount % 5000 === 0) {
      process.stdout.write(
        `\r📊 Processed ${processedCount}/${allCards.length} cards...`
      );
    }

    // Skip cards without usable artwork
    if (!hasUsableArt(card)) {
      continue;
    }

    // Check which formats this card is ACTUALLY legal in (no assumptions)
    const legalFormats = [];
    for (const format of FORMATS) {
      if (isCardLegalInFormat(card, format)) {
        legalFormats.push(format);
        formatCounts[format]++;
      }
    }

    // Only include cards that are legal in at least one format
    if (legalFormats.length > 0) {
      const processedCard = processCard(card);
      // Store the exact formats where this card is legal
      processedCard.formats = legalFormats;
      allFormatCards.push(processedCard);
    }
  }

  console.log(`\n✅ Processing complete!`);

  // Log format statistics
  for (const format of FORMATS) {
    console.log(`📈 ${format}: ${formatCounts[format]} cards`);
  }

  console.log(
    `📋 Summary: ${unusableArtCards.length} legal cards excluded due to unusable art`
  );

  return { allFormatCards, formatCounts };
}

async function saveOptimizedFile(allFormatCards, formatCounts, bulkInfo) {
  console.log('\n💾 Saving optimized card file...');

  // Ensure data directory exists
  await fs.mkdir(DATA_DIR, { recursive: true });

  const cardData = {
    cards: allFormatCards,
    formatCounts,
    lastUpdated: new Date().toISOString(),
    bulkDataUpdated: bulkInfo.updated_at,
    totalCards: allFormatCards.length,
  };

  const cardFilePath = path.join(DATA_DIR, 'cards.json');
  await fs.writeFile(cardFilePath, JSON.stringify(cardData));

  const stats = await fs.stat(cardFilePath);

  console.log(`✅ Saved ${allFormatCards.length} cards to cards.json`);
  console.log(`📦 File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

  // Create metadata
  const metadata = {
    lastUpdated: new Date().toISOString(),
    bulkDataUpdated: bulkInfo.updated_at,
    formatCounts,
    totalCards: allFormatCards.length,
    fileSize: stats.size,
  };

  await fs.writeFile(
    path.join(DATA_DIR, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  );

  console.log(`📋 Metadata saved`);
}

async function main() {
  try {
    console.log('🚀 Starting card data update process...\n');

    const bulkInfo = await getBulkDataInfo();
    const allCards = await downloadBulkData(bulkInfo);
    const { allFormatCards, formatCounts } = await processFormatData(allCards);
    await saveOptimizedFile(allFormatCards, formatCounts, bulkInfo);

    console.log('\n🎉 Card data update completed successfully!');
  } catch (error) {
    console.error('\n💥 Error during update process:', error);
    process.exit(1);
  }
}

// Fixed execution check for ES modules
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  main();
}

export { main };

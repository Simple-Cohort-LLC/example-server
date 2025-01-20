const { PrismaClient } = require("@prisma/client");
const puppeteer = require("puppeteer");

const prisma = new PrismaClient();

async function fetchTokenDetails(network, contractAddress, tokenId) {
  let apiUrl;

  switch (network) {
    case "base":
      apiUrl = `https://base.blockscout.com/api/v2/tokens/${contractAddress}/instances/${tokenId}`;
      break;
    case "zora":
      apiUrl = `https://explorer.zora.energy/api/v2/tokens/${contractAddress}/instances/${tokenId}`;
      break;
    default:
      console.log(`Unsupported network: ${network}`);
      return null;
  }

  if (!apiUrl) {
    return null;
  }

  try {
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: { accept: "application/json" },
    });

    if (!response.ok) {
      console.error(
        `Failed to fetch data from block explorer: ${response.statusText}`
      );
      return null;
    }

    const data = await response.json();

    if (!data.image_url || !data.metadata.description || !data.metadata.name) {
      return null;
    }

    return {
      image: data.image_url,
      description: data.metadata.description,
      name: data.metadata.name,
    };
  } catch (error) {
    console.error("Error fetching data:", error);
    return null;
  }
}

function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
}

async function scrapeZora() {
  const url = "https://zora.co/explore/featured";

  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: "networkidle2" });

  // let feed load
  delay(5000);

  const hrefs = await page.evaluate(() => {
    const anchors = document.querySelectorAll("a");
    return Array.from(anchors).map((anchor) => anchor.href);
  });

  for (const href of hrefs) {
    if (href.includes("/collect/")) {
      const collectPart = href.split("/collect/")[1];
      const [networkAndContract, tokenId] = collectPart.split("/");
      const [network, contractAddress] = networkAndContract.split(":");

      const existing = await prisma.zoraNft.findUnique({
        where: { href },
      });

      if (existing || !network || !contractAddress || !tokenId) continue;

      const tokenDetails = await fetchTokenDetails(
        network.trim(),
        contractAddress.trim(),
        tokenId.trim()
      );

      if (!tokenDetails) {
        continue;
      }

      const data = {
        network: network.trim(),
        contract: contractAddress.trim(),
        tokenId: tokenId.trim(),
        href: href.trim(),
        metadataUri: tokenDetails.image,
        name: tokenDetails.name,
        description: tokenDetails.description,
      };

      try {
        await prisma.zoraNft.create({
          data,
        });
      } catch (error) {
        console.error(`Failed to save: ${href}`, error);
      }
    }
  }

  await browser.close();
}

scrapeZora()
  .catch((error) => {
    console.error(error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

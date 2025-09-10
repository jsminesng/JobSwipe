// /api/jobs.js
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const {
    companies = "airbnb,doordash,openai,spotify,stripe,shopify,github,netflix,uber,lyft",
    source = "greenhouse",
  } = req.query;

  const orgs = companies.split(",");
  let jobs = [];

  for (const org of orgs) {
    try {
      if (source === "greenhouse") {
        const r = await fetch(
          `https://boards-api.greenhouse.io/v1/boards/${org}/jobs`
        );
        const json = await r.json();
        json.jobs.forEach((j) => {
          jobs.push({
            id: `gh-${org}-${j.id}`,
            company: org,
            title: j.title,
            location: j.location?.name || "",
            workType: "any",
            level: inferLevel(j.title),
            skills: [],
            applyUrl: j.absolute_url,
          });
        });
      }
      // TODO: Lever, Ashby도 비슷하게 붙일 수 있음
    } catch (e) {
      console.error("fail", org, e.message);
    }
  }

  res.status(200).json(jobs.slice(0, 30));
};

function inferLevel(title = "") {
  const t = title.toLowerCase();
  if (t.includes("intern")) return "intern";
  if (t.includes("junior") || t.includes("new grad")) return "junior";
  return "any";
}

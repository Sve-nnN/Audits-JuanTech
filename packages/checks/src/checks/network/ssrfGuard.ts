import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { Agent } from "undici";

/**
 * Destination validation for the network checks (threats T-31-01 / T-31-02).
 *
 * **Why this cannot be a pattern match on the hostname.** The check that
 * matters is not "does this name look internal": a perfectly ordinary public
 * domain can resolve to loopback, to a private range or to the cloud-metadata
 * address, and that is exactly the attack. So the hostname is resolved and the
 * resulting *addresses* are classified numerically, octet by octet. A name
 * that resolves to one public and one loopback address is rejected: it would
 * be enough for the network stack to pick the second one.
 *
 * **Rebinding is closed by pinning, not by resolving twice.** Classifying the
 * addresses is worth nothing if the transport resolves the name again on its
 * own: between the two resolutions an authoritative server under the
 * attacker's control answers something public first and the loopback (or the
 * metadata address) second, and the connection opens against the internal
 * destination. So the verdict carries the addresses it validated and the
 * caller opens the connection through `pinnedDispatcher`, whose resolver
 * hands back exactly that address instead of asking the system again.
 */

/** Rejected because the destination resolves somewhere we must never connect to. */
export const REASON_NOT_PUBLIC = "destino no público";

/** Rejected because the destination could not be resolved at all. */
export const REASON_UNRESOLVABLE = "destino no resoluble";

/**
 * On acceptance the verdict carries the very addresses that were classified.
 * They are not decoration: they are what the connection must use, because a
 * second resolution is a second chance for the attacker to answer something
 * else.
 */
export type DestinationVerdict =
  | { ok: true; addresses: string[] }
  | { ok: false; reason: string };

function isPrivateV4Octets(octets: number[]): boolean {
  const [a, b] = octets as [number, number, number, number];
  if (a === 0) return true; // 0.0.0.0/8 — "this network"
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 — loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 — link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 — carrier-grade NAT
  return false;
}

function isPrivateV4(address: string): boolean {
  const octets = address.split(".").map((part) => Number(part));
  if (octets.length !== 4) return true;
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return true;
  return isPrivateV4Octets(octets);
}

/** Expands any IPv6 form (compressed, zoned, IPv4-tailed) into its 8 numeric groups. */
function expandV6(address: string): number[] | null {
  let text = address.toLowerCase();

  const zone = text.indexOf("%");
  if (zone !== -1) text = text.slice(0, zone);

  let trailing: number[] = [];
  const lastColon = text.lastIndexOf(":");
  const lastPart = text.slice(lastColon + 1);
  if (lastPart.includes(".")) {
    const octets = lastPart.split(".").map((part) => Number(part));
    if (octets.length !== 4) return null;
    if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return null;
    const [a, b, c, d] = octets as [number, number, number, number];
    trailing = [(a << 8) | b, (c << 8) | d];
    const head = text.slice(0, lastColon + 1);
    text = head.endsWith("::") ? head : head.slice(0, -1);
  }

  const halves = text.split("::");
  if (halves.length > 2) return null;

  const toGroups = (part: string): number[] =>
    part === "" ? [] : part.split(":").filter((g) => g !== "").map((g) => parseInt(g, 16));

  let groups: number[];
  if (halves.length === 2) {
    const head = toGroups(halves[0] ?? "");
    const tail = toGroups(halves[1] ?? "");
    const fill = 8 - trailing.length - head.length - tail.length;
    if (fill < 0) return null;
    groups = [...head, ...Array<number>(fill).fill(0), ...tail, ...trailing];
  } else {
    groups = [...toGroups(halves[0] ?? ""), ...trailing];
  }

  if (groups.length !== 8) return null;
  if (groups.some((g) => !Number.isInteger(g) || g < 0 || g > 0xffff)) return null;
  return groups;
}

function isPrivateV6(address: string): boolean {
  const groups = expandV6(address);
  if (!groups) return true;

  // IPv4 mapeada dentro de v6 (::ffff:a.b.c.d): el disfraz más común del
  // bucle local, así que se desenvuelve y se evalúa con la tabla de v4.
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    const high = groups[6] ?? 0;
    const low = groups[7] ?? 0;
    return isPrivateV4Octets([high >> 8, high & 0xff, low >> 8, low & 0xff]);
  }

  if (groups.every((g) => g === 0)) return true; // ::
  if (groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1) return true; // ::1

  const first = groups[0] ?? 0;
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 — unique local
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 — link local
  return false;
}

/**
 * Classifies a literal address. Pure and synchronous, no I/O.
 *
 * Anything that is not recognised as a valid address of either version is
 * classified as private: the safe answer in front of the unknown is to refuse.
 */
export function isPrivateAddress(ip: string): boolean {
  const candidate = ip.trim();
  const version = isIP(candidate);
  if (version === 4) return isPrivateV4(candidate);
  if (version === 6) return isPrivateV6(candidate);
  return true;
}

/**
 * Resolves the destination host asking for **every** address and refuses if
 * **any** of them is private. Literal-address hosts are classified directly,
 * without asking the resolver.
 */
export async function assertPublicDestination(url: string): Promise<DestinationVerdict> {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return { ok: false, reason: REASON_UNRESOLVABLE };
  }

  // Una URL escribe una dirección v6 entre corchetes; el clasificador recibe
  // la dirección desnuda.
  const host =
    hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;

  if (isIP(host) !== 0) {
    return isPrivateAddress(host)
      ? { ok: false, reason: REASON_NOT_PUBLIC }
      : { ok: true, addresses: [host] };
  }

  let resolved: { address: string }[];
  try {
    resolved = await lookup(host, { all: true });
  } catch {
    return { ok: false, reason: REASON_UNRESOLVABLE };
  }

  if (resolved.length === 0) return { ok: false, reason: REASON_UNRESOLVABLE };
  if (resolved.some((entry) => isPrivateAddress(entry.address))) {
    return { ok: false, reason: REASON_NOT_PUBLIC };
  }
  return { ok: true, addresses: resolved.map((entry) => entry.address) };
}

/**
 * Transport agent that connects to an address already classified as public,
 * instead of resolving the name a second time (threat T-31-01, DNS rebinding).
 *
 * The classification is repeated inside the resolver, on purpose and even
 * though the caller already ran it: this function is the last gate before the
 * socket, and an empty or tampered address list must fail closed here rather
 * than fall back to the system resolver. The error message is our own closed
 * vocabulary — it may surface in a network error and must never carry text the
 * destination influences.
 */
export function pinnedDispatcher(addresses: string[]): Agent {
  return new Agent({
    connect: {
      lookup: (_hostname, options, callback) => {
        const pinned = addresses.filter((address) => !isPrivateAddress(address));
        const first = pinned[0];
        if (first === undefined) {
          callback(new Error(REASON_NOT_PUBLIC), []);
          return;
        }
        // El transporte pide el conjunto entero (`all`), no una dirección
        // suelta, así que las dos formas de la respuesta tienen que estar.
        if (options.all === true) {
          callback(
            null,
            pinned.map((address) => ({ address, family: isIP(address) })),
          );
          return;
        }
        callback(null, first, isIP(first));
      },
    },
  });
}

import { checkRateLimitAndThrowError } from "@calcom/lib/checkRateLimitAndThrowError";
import { getPlaceholderAvatar } from "@calcom/lib/defaultAvatarImage";
import { getUserAvatarUrl } from "@calcom/lib/getAvatarUrl";
import { getBookerBaseUrlSync } from "@calcom/lib/getBookerUrl/client";
import { getBookerBaseUrl } from "@calcom/lib/getBookerUrl/server";
import { EventTypeRepository } from "@calcom/lib/server/repository/eventType";
import { MembershipRepository } from "@calcom/lib/server/repository/membership";
import { ProfileRepository } from "@calcom/lib/server/repository/profile";
import type { PrismaClient } from "@calcom/prisma";
import { MembershipRole, SchedulingType } from "@calcom/prisma/enums";
import { teamMetadataSchema } from "@calcom/prisma/zod-utils";

import { TRPCError } from "@trpc/server";

import type { TrpcSessionUser } from "../../../trpc";
import type { TGetEventTypeOptionsSchema } from "./getEventTypeOptions.schema";

type GetEventTypeOptions = {
  ctx: {
    user: NonNullable<TrpcSessionUser>;
    prisma: PrismaClient;
  };
  input: TGetEventTypeOptionsSchema;
};

export const getEventTypeOptions = async ({ ctx, input }: GetEventTypeOptions) => {
  await checkRateLimitAndThrowError({
    identifier: `eventTypes:getEventTypeOptions:${ctx.user.id}`,
    rateLimitingType: "common",
  });

  const user = ctx.user;
  const teamId = input?.teamId;
  const isOrg = input?.isOrg;
  const selectedOptions = input?.selectedOptions;
  const isMixedEventType = input?.isMixedEventType;

  const userProfile = ctx.user.profile;
  const profile = await ProfileRepository.findByUpId(userProfile.upId);
  const parentOrgHasLockedEventTypes =
    profile?.organization?.organizationSettings?.lockEventTypeCreationForUsers;

  const [profileMemberships, profileEventTypes] = await Promise.all([
    MembershipRepository.findAllByUpIdIncludeMinimalEventTypes(
      {
        upId: userProfile.upId,
      },
      {
        where: {
          accepted: true,
        },
        skipEventTypes: !!isOrg,
      }
    ),
    EventTypeRepository.findAllByUpIdWithMinmalData(
      {
        upId: userProfile.upId,
        userId: user.id,
      },
      {
        where: {
          teamId: null,
        },
        orderBy: [
          {
            position: "desc",
          },
          {
            id: "asc",
          },
        ],
      }
    ),
  ]);

  if (!profile) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  }

  const memberships = profileMemberships.map((membership) => ({
    ...membership,
    team: {
      ...membership.team,
      metadata: teamMetadataSchema.parse(membership.team.metadata),
    },
  }));

  const teamMemberships = profileMemberships.map((membership) => ({
    teamId: membership.team.id,
    membershipRole: membership.role,
  }));

  console.log("profileMemberships", profileMemberships);
  console.log("teamMemberships", teamMemberships);

  type EventTypeGroup = {
    teamId?: number | null;
    parentId?: number | null;
    bookerUrl: string;
    membershipRole?: MembershipRole | null;
    profile: {
      slug: (typeof profile)["username"] | null;
      name: (typeof profile)["name"];
      image: string;
      eventTypesLockedByOrg?: boolean;
    };
    eventTypes?: any;
  };

  let eventTypeGroups: EventTypeGroup[] = [];
  const bookerUrl = await getBookerBaseUrl(profile.organizationId ?? null);

  eventTypeGroups.push({
    teamId: null,
    bookerUrl,
    membershipRole: null,
    profile: {
      slug: profile.username,
      name: profile.name,
      image: getUserAvatarUrl({
        avatarUrl: profile.avatarUrl,
      }),
      eventTypesLockedByOrg: parentOrgHasLockedEventTypes,
    },
    eventTypes: profileEventTypes,
  });

  eventTypeGroups = ([] as EventTypeGroup[]).concat(
    eventTypeGroups,
    await Promise.all(
      memberships
        .filter((mmship) => {
          if (mmship?.team?.isOrganization) {
            return false;
          }
          return true;
        })
        .map(async (membership) => {
          console.log("membership", membership);
          const orgMembership = teamMemberships.find(
            (teamM) => teamM.teamId === membership.team.parentId
          )?.membershipRole;

          const team = {
            ...membership.team,
            metadata: teamMetadataSchema.parse(membership.team.metadata),
          };

          const slug = null;

          // if (forRoutingForms) {
          //   // For Routing form we want to ensure that after migration of team to an org, the URL remains same for the team
          //   // Once we solve this https://github.com/calcom/cal.com/issues/12399, we can remove this conditional change in slug
          //   slug = `team/${team.slug}`;
          // } else {
          //   // In an Org, a team can be accessed without /team prefix as well as with /team prefix
          //   slug = team.slug ? (!team.parentId ? `team/${team.slug}` : `${team.slug}`) : null;
          // }

          const eventTypes = team.eventTypes;
          const teamParentMetadata = team.parent ? teamMetadataSchema.parse(team.parent.metadata) : null;
          return {
            teamId: team.id,
            parentId: team.parentId,
            bookerUrl: getBookerBaseUrlSync(team.parent?.slug ?? teamParentMetadata?.requestedSlug ?? null),
            membershipRole:
              orgMembership && compareMembership(orgMembership, membership.role)
                ? orgMembership
                : membership.role,
            profile: {
              image: team.parent
                ? getPlaceholderAvatar(team.parent.logoUrl, team.parent.name)
                : getPlaceholderAvatar(team.logoUrl, team.name),
              name: team.name,
              slug,
            },
            eventTypes: eventTypes
              ?.filter((evType) => {
                const res = evType.userId === null || evType.userId === user.id;
                return res;
              })
              ?.filter((evType) =>
                membership.role === MembershipRole.MEMBER
                  ? evType.schedulingType !== SchedulingType.MANAGED
                  : true
              ),
          };
        })
    )
  );

  const profilesTeamsOptions = eventTypeGroups
    .map((group) => ({
      ...group.profile,
      teamId: group.teamId,
    }))
    .filter((profile) => !!profile.teamId)
    .map((profile) => {
      return {
        value: String(profile.teamId) || "",
        label: profile.name || profile.slug || "",
      };
    });

  const filterDistinctEventTypes = !teamId && isMixedEventType;

  const distinctEventTypes = new Set();
  if (filterDistinctEventTypes) selectedOptions?.forEach((option) => distinctEventTypes.add(option.value));

  const allEventTypeOptions =
    eventTypeGroups.reduce((options, group) => {
      //       /** don't show team event types for user workflow */
      if (!teamId && group.teamId) return options;
      //       /** only show correct team event types for team workflows */
      if (teamId && teamId !== group.teamId) return options;

      return [
        ...options,
        ...group.eventTypes
          .filter((evType) => {
            if (!filterDistinctEventTypes) return true;

            const val = String(evType.id);
            const duplicate = distinctEventTypes.has(val);
            distinctEventTypes.add(val);
            return !duplicate;
          })
          .filter(
            (evType) =>
              !evType.metadata?.managedEventConfig ||
              !!evType.metadata?.managedEventConfig.unlockedFields?.workflows ||
              !!teamId
          )
          .map((eventType) => ({
            value: String(eventType.id),
            label: `${eventType.title} ${
              eventType.children && eventType.children.length ? `(+${eventType.children.length})` : ``
            }`,
          })),
      ];
    }, (filterDistinctEventTypes ? selectedOptions ?? [] : []) as Option[]) || [];

  return {
    allEventTypeOptions,
    profilesTeamsOptions,
  };
};

export function compareMembership(mship1: MembershipRole, mship2: MembershipRole) {
  const mshipToNumber = (mship: MembershipRole) =>
    Object.keys(MembershipRole).findIndex((mmship) => mmship === mship);
  return mshipToNumber(mship1) > mshipToNumber(mship2);
}

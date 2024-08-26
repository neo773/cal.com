import { Expose, Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsTimeZone,
  IsUrl,
  ValidateNested,
} from "class-validator";

import type { BookingLanguageType } from "../inputs/language";
import { BookingLanguage } from "../inputs/language";

class Attendee {
  @IsString()
  @Expose()
  name!: string;

  @IsEmail()
  @Expose()
  email!: string;

  @IsTimeZone()
  @Expose()
  // note(Lauris): setup CapitalizeTimezone
  timeZone!: string;

  @IsEnum(BookingLanguage)
  @Expose()
  @IsOptional()
  language?: BookingLanguageType;

  @IsBoolean()
  @Expose()
  absent!: boolean;
}
export class BookingOutput_2024_08_13 {
  @IsInt()
  @Expose()
  id!: number;

  @IsString()
  @Expose()
  uid!: string;

  @IsInt()
  @Expose()
  hostId!: number;

  @IsEnum(["cancelled", "accepted", "rejected", "pending", "awaiting_host"])
  @Expose()
  status!: "cancelled" | "accepted" | "rejected" | "pending" | "awaiting_host";

  @IsString()
  @IsOptional()
  @Expose()
  cancellationReason?: string;

  @IsString()
  @IsOptional()
  @Expose()
  reschedulingReason?: string;

  @IsDateString()
  @Expose()
  start!: string;

  @IsDateString()
  @Expose()
  end!: string;

  @IsInt()
  @Expose()
  duration!: number;

  @IsInt()
  @Expose()
  eventTypeId!: number;

  @ValidateNested()
  @Type(() => Attendee)
  @Expose()
  attendee!: Attendee;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @Expose()
  guests?: string[];

  @IsUrl()
  @IsOptional()
  @Expose()
  meetingUrl?: string;

  @IsBoolean()
  @Expose()
  absentHost!: boolean;
}

export class RecurringBookingOutput_2024_08_13 {
  @IsInt()
  @Expose()
  id!: number;

  @IsString()
  @Expose()
  uid!: string;

  @IsInt()
  @Expose()
  hostId!: number;

  @IsEnum(["cancelled", "accepted", "rejected", "pending", "awaiting_host"])
  @Expose()
  status!: "cancelled" | "accepted" | "rejected" | "pending" | "awaiting_host";

  @IsString()
  @IsOptional()
  @Expose()
  cancellationReason?: string;

  @IsString()
  @IsOptional()
  @Expose()
  reschedulingReason?: string;

  @IsDateString()
  @Expose()
  start!: string;

  @IsDateString()
  @Expose()
  end!: string;

  @IsInt()
  @Expose()
  duration!: number;

  @IsInt()
  @Expose()
  eventTypeId!: number;

  @IsString()
  @Expose()
  recurringBookingUid!: string;

  @ValidateNested()
  @Type(() => Attendee)
  @Expose()
  attendee!: Attendee;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @Expose()
  guests?: string[];

  @IsUrl()
  @IsOptional()
  @Expose()
  meetingUrl?: string;

  @IsBoolean()
  absentHost!: boolean;
}

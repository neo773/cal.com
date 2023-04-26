import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import {
  Dropdown,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownItem,
  DropdownMenuTrigger,
  TextField,
} from "@calcom/ui";
import { ChevronDown } from "@calcom/ui/components/icon";

import { getWorkflowTimeUnitOptions } from "../lib/getOptions";
import type { FormValues } from "../pages/workflow";

type Props = {
  form: UseFormReturn<FormValues>;
};

export const TimeTimeUnitInput = (props: Props) => {
  const { form } = props;
  const { t } = useLocale();
  const timeUnitOptions = getWorkflowTimeUnitOptions(t);

  const [timeUnit, setTimeUnit] = useState(form.getValues("timeUnit"));

  return (
    <div className="flex">
      <div className="grow">
        <TextField
          type="number"
          min="1"
          label=""
          defaultValue={form.getValues("time") || 24}
          className="-mt-2 rounded-r-none text-sm focus:ring-0"
          {...form.register("time", { valueAsNumber: true })}
          addOnSuffix={
            <Dropdown>
              <DropdownMenuTrigger asChild>
                <button className="flex">
                  <div className="mr-1 w-3/4">
                    {timeUnit ? t(`${timeUnit.toLowerCase()}_timeUnit`) : "undefined"}{" "}
                  </div>
                  <div className="w-1/4 pt-1">
                    <ChevronDown />
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {timeUnitOptions.map((option, index) => (
                  <DropdownMenuItem key={index} className="outline-none">
                    <DropdownItem
                      key={index}
                      type="button"
                      onClick={() => {
                        // @ts-expect-error WIP
                        setTimeUnit(option.value);
                        // @ts-expect-error WIP
                        form.setValue("timeUnit", option.value);
                      }}>
                      {option.label}
                    </DropdownItem>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </Dropdown>
          }
        />
      </div>
    </div>
  );
};

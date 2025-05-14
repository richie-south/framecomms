export type Available = Record<
  string,
  string | Object | number | ((...args: any[]) => any)
>

export type Attributes = {
  iframe?: Record<string, string>
}

export type GetContainer = ({
  uid,
  iframe,
}: {
  uid: string
  iframe: HTMLIFrameElement
}) => HTMLElement

export type Options = {
  origin?: string
}
